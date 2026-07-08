package io.realm.debugger

import android.os.Handler
import android.os.Looper
import io.realm.kotlin.Realm
import io.realm.kotlin.dynamic.DynamicRealmObject
import io.realm.kotlin.ext.query
import io.realm.kotlin.query.RealmResults
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * A Live, Real-Time Read-Only (and Write-Capable) Database Debugger Client
 * for Native Android applications using MongoDB Realm Kotlin SDK.
 *
 * Connects your active Realm instance directly to the `realm-debugger`
 * dashboard over WebSockets.
 */
class RealmDebuggerClient(
    private val realm: Realm,
    private val serverUrl: String = "",
    private val port: Int? = null
) {
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private val handler = Handler(Looper.getMainLooper())
    private var isConnected = false

    private val resolvedUrl: String
        get() {
            if (serverUrl.isNotEmpty()) {
                val trimmed = serverUrl.trim()
                return if (trimmed.all { it.isDigit() }) {
                    "ws://10.0.2.2:$trimmed"
                } else {
                    trimmed
                }
            }
            val targetPort = port ?: 5000
            return "ws://10.0.2.2:$targetPort"
        }

    fun start() {
        connect()
    }

    private fun connect() {
        println("[RealmDebugger] Connecting to inspector server at $resolvedUrl...")
        val request = Request.Builder().url(resolvedUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                println("[RealmDebugger] Connected to debugger server.")
                sendInitialState()
                setupChangeListeners()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                handleDisconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                println("[RealmDebugger] Connection failed: ${t.message}")
                handleDisconnect()
            }
        })
    }

    private fun handleDisconnect() {
        isConnected = false
        webSocket = null
        // Reconnect after 5 seconds
        handler.postDelayed({
            if (!isConnected) connect()
        }, 5000)
    }

    private fun sendInitialState() {
        if (!isConnected) return
        try {
            val payload = JSONObject()
            payload.put("event", "APP_CONNECT")
            // Safely get filename or config path
            payload.put("realmFile", realm.configuration.path.split("/").last())
            payload.put("schemas", serializeSchemas())
            payload.put("data", serializeAllData())
            webSocket?.send(payload.toString())
        } catch (e: Exception) {
            println("[RealmDebugger] Error sending initial state: ${e.message}")
        }
    }

    private fun serializeSchemas(): JSONArray {
        val schemasArray = JSONArray()
        for (schema in realm.schema()) {
            val schemaObj = JSONObject()
            schemaObj.put("name", schema.name)

            val propsArray = JSONArray()
            for (prop in schema.properties) {
                val propObj = JSONObject()
                propObj.put("name", prop.name)
                propObj.put("type", prop.type.toString())
                propObj.put("optional", prop.isNullable)
                propObj.put("primaryKey", prop.isPrimaryKey)
                propsArray.put(propObj)
            }
            schemaObj.put("properties", propsArray)
            schemasArray.put(schemaObj)
        }
        return schemasArray
    }

    private fun serializeAllData(): JSONObject {
        val dataObj = JSONObject()
        for (schema in realm.schema()) {
            val objects = realm.dynamic.query(schema.name).find()
            val recordsArray = JSONArray()
            for (obj in objects) {
                recordsArray.put(serializeObject(obj))
            }
            dataObj.put(schema.name, recordsArray)
        }
        return dataObj
    }

    private fun serializeObject(obj: DynamicRealmObject): JSONObject {
        val recordObj = JSONObject()
        val schema = realm.schema().firstOrNull { it.name == obj.type } ?: return recordObj

        for (prop in schema.properties) {
            val name = prop.name
            try {
                // Fetch dynamic fields based on type
                if (prop.isNullable && obj.getValue(name, Any::class) == null) {
                    recordObj.put(name, JSONObject.NULL)
                } else {
                    val value = obj.getValue(name, Any::class)
                    if (value is DynamicRealmObject) {
                        recordObj.put(name, "[Link: ${value.type}]")
                    } else {
                        recordObj.put(name, value)
                    }
                }
            } catch (e: Exception) {
                recordObj.put(name, "[Error: ${e.message}]")
            }
        }
        return recordObj
    }

    private fun setupChangeListeners() {
        // Stream database updates on any changes
        for (schema in realm.schema()) {
            realm.dynamic.query(schema.name).asFlow().subscribe {
                sendChangeUpdate(schema.name)
            }
        }
    }

    private fun sendChangeUpdate(schemaName: String) {
        if (!isConnected) return
        try {
            val payload = JSONObject()
            payload.put("event", "REALM_CHANGED")
            payload.put("realmFile", realm.configuration.path.split("/").last())
            payload.put("changeType", "UPDATE")
            payload.put("schemaName", schemaName)
            payload.put("schemas", serializeSchemas())
            payload.put("data", serializeAllData())
            webSocket?.send(payload.toString())
        } catch (e: Exception) {
            println("[RealmDebugger] Error sending change update: ${e.message}")
        }
    }

    private fun handleIncomingMessage(jsonStr: String) {
        try {
            val msg = JSONObject(jsonStr)
            val event = msg.optString("event")

            if (event == "FORCE_REFRESH") {
                sendInitialState()
            } else if (event == "ADD_RECORD") {
                handleAddRecord(msg.getString("schemaName"), msg.getJSONObject("record"))
            } else if (event == "UPDATE_RECORD") {
                handleUpdateRecord(
                    msg.getString("schemaName"),
                    msg.get("primaryKeyVal"),
                    msg.getJSONObject("record")
                )
            }
        } catch (e: Exception) {
            println("[RealmDebugger] Error processing message: ${e.message}")
        }
    }

    private fun handleAddRecord(schemaName: String, record: JSONObject) {
        try {
            realm.writeBlocking {
                val copy = JSONObject(record.toString())
                val dynamicObj = this.dynamic.copyToRealm(DynamicRealmObject.create(schemaName))
                // Populate properties
                val schema = realm.schema().first { it.name == schemaName }
                for (prop in schema.properties) {
                    if (copy.has(prop.name)) {
                        dynamicObj.set(prop.name, copy.get(prop.name))
                    }
                }
            }
            sendOperationStatus(true, "Record added successfully.")
        } catch (e: Exception) {
            sendOperationStatus(false, "Failed to add record: ${e.message}")
        }
    }

    private fun handleUpdateRecord(schemaName: String, pkVal: Any, record: JSONObject) {
        try {
            val schema = realm.schema().first { it.name == schemaName }
            val pkName = schema.properties.firstOrNull { it.isPrimaryKey }?.name 
                ?: throw Exception("No primary key defined.")

            realm.writeBlocking {
                val obj = this.dynamic.query(schemaName, "$pkName == $0", pkVal).first().find()
                    ?: throw Exception("Record not found.")

                val copy = JSONObject(record.toString())
                for (prop in schema.properties) {
                    if (prop.name != pkName && copy.has(prop.name)) {
                        obj.set(prop.name, copy.get(prop.name))
                    }
                }
            }
            sendOperationStatus(true, "Record updated successfully.")
        } catch (e: Exception) {
            sendOperationStatus(false, "Failed to update record: ${e.message}")
        }
    }

    private fun sendOperationStatus(success: Boolean, msg: String) {
        if (!isConnected) return
        val payload = JSONObject()
        payload.put("event", if (success) "OPERATION_SUCCESS" else "OPERATION_ERROR")
        payload.put("message", msg)
        webSocket?.send(payload.toString())
    }

    fun dispose() {
        isConnected = false
        webSocket?.close(1000, "Client disposed")
        webSocket = null
    }
}
