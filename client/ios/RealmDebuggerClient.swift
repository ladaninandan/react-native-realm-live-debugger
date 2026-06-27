import Foundation
import RealmSwift

/// A Live, Real-Time Read-Only (and Write-Capable) Database Debugger Client
/// for Native iOS applications using MongoDB Realm Swift SDK.
///
/// Connects your active Realm instance directly to the `realm-debugger`
/// dashboard over WebSockets.
public class RealmDebuggerClient {
    private let realm: Realm
    private let serverUrl: URL
    private var webSocketTask: URLSessionWebSocketTask?
    private var isConnected = false
    private var notificationTokens: [NotificationToken] = []
    
    public init(realm: Realm, serverUrlString: String = "ws://localhost:5000") {
        self.realm = realm
        self.serverUrl = URL(string: serverUrlString)!
    }
    
    public func start() {
        connect()
    }
    
    private func connect() {
        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: serverUrl)
        webSocketTask?.resume()
        
        // Start listening for messages
        listenForMessages()
        
        // Notify the dashboard we connected
        self.isConnected = true
        self.sendInitialState()
        self.setupChangeListeners()
    }
    
    private func handleDisconnect() {
        isConnected = false
        webSocketTask = nil
        notificationTokens.forEach { $0.invalidate() }
        notificationTokens.removeAll()
        
        print("[RealmDebugger] Disconnected. Reconnecting in 5 seconds...")
        DispatchQueue.global().asyncAfter(deadline: .now() + 5.0) { [weak self] in
            self?.connect()
        }
    }
    
    private func listenForMessages() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleIncomingMessage(text)
                default:
                    break
                }
                self?.listenForMessages()
            case .failure(let error):
                print("[RealmDebugger] WebSocket failure: \(error.localizedDescription)")
                self?.handleDisconnect()
            }
        }
    }
    
    private func sendInitialState() {
        guard isConnected else { return }
        
        let payload: [String: Any] = [
            "event": "APP_CONNECT",
            "realmFile": realm.configuration.fileURL?.lastPathComponent ?? "default.realm",
            "schemas": serializeSchemas(),
            "data": serializeAllData()
        ]
        
        sendJson(payload)
    }
    
    private func serializeSchemas() -> [[String: Any]] {
        return realm.schema.objectSchema.map { objectSchema in
            let properties = objectSchema.properties.map { prop in
                return [
                    "name": prop.name,
                    "type": String(describing: prop.type),
                    "optional": prop.isOptional,
                    "primaryKey": prop.isPrimaryKey
                ] as [String: Any]
            }
            
            return [
                "name": objectSchema.className,
                "properties": properties
            ]
        }
    }
    
    private func serializeAllData() -> [String: [[String: Any]]] {
        var data: [String: [[String: Any]]] = [:]
        
        for objectSchema in realm.schema.objectSchema {
            let className = objectSchema.className
            let objects = realm.dynamicObjects(className)
            
            let records = objects.map { obj in
                return serializeObject(obj, schema: objectSchema)
            }
            
            data[className] = Array(records)
        }
        
        return data
    }
    
    private func serializeObject(_ obj: DynamicObject, schema: ObjectSchema) -> [String: Any] {
        var record: [String: Any] = [:]
        
        for prop in schema.properties {
            let name = prop.name
            guard let val = obj[name] else {
                record[name] = NSNull()
                continue
            }
            
            if let linkedObj = val as? DynamicObject {
                record[name] = "[Link: \(linkedObj.objectSchema.className)]"
            } else if let dateVal = val as? Date {
                let formatter = ISO8601DateFormatter()
                record[name] = formatter.string(from: dateVal)
            } else {
                record[name] = val
            }
        }
        
        return record
    }
    
    private func setupChangeListeners() {
        for objectSchema in realm.schema.objectSchema {
            let className = objectSchema.className
            let token = realm.dynamicObjects(className).observe { [weak self] changes in
                switch changes {
                case .update:
                    self?.sendChangeUpdate(className)
                default:
                    break
                }
            }
            notificationTokens.append(token)
        }
    }
    
    private func sendChangeUpdate(_ className: String) {
        guard isConnected else { return }
        
        let payload: [String: Any] = [
            "event": "REALM_CHANGED",
            "realmFile": realm.configuration.fileURL?.lastPathComponent ?? "default.realm",
            "changeType": "UPDATE",
            "schemaName": className,
            "schemas": serializeSchemas(),
            "data": serializeAllData()
        ]
        
        sendJson(payload)
    }
    
    private func handleIncomingMessage(_ jsonStr: String) {
        guard let data = jsonStr.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let event = json["event"] as? String else {
            return
        }
        
        if event == "FORCE_REFRESH" {
            sendInitialState()
        } else if event == "ADD_RECORD",
                  let schemaName = json["schemaName"] as? String,
                  let record = json["record"] as? [String: Any] {
            handleAddRecord(schemaName, record: record)
        } else if event == "UPDATE_RECORD",
                  let schemaName = json["schemaName"] as? String,
                  let pkVal = json["primaryKeyVal"],
                  let record = json["record"] as? [String: Any] {
            handleUpdateRecord(schemaName, pkVal: pkVal, record: record)
        }
    }
    
    private func handleAddRecord(_ schemaName: String, record: [String: Any]) {
        do {
            try realm.write {
                let obj = realm.create(DynamicObject.self, value: record, update: .error)
            }
            sendOperationStatus(success: true, message: "Record added successfully.")
        } catch {
            sendOperationStatus(success: false, message: "Failed to add record: \(error.localizedDescription)")
        }
    }
    
    private func handleUpdateRecord(_ schemaName: String, pkVal: Any, record: [String: Any]) {
        do {
            guard let objectSchema = realm.schema.objectSchema.first(where: { $0.className == schemaName }),
                  let pkProp = objectSchema.primaryKeyProperty else {
                throw NSError(domain: "RealmDebugger", code: 1, userInfo: [NSLocalizedDescriptionKey: "No primary key found"])
            }
            
            try realm.write {
                guard let obj = realm.dynamicObject(ofType: schemaName, forPrimaryKey: pkVal) else {
                    throw NSError(domain: "RealmDebugger", code: 2, userInfo: [NSLocalizedDescriptionKey: "Record not found"])
                }
                
                for (key, val) in record {
                    if key != pkProp.name {
                        obj[key] = val
                    }
                }
            }
            sendOperationStatus(success: true, message: "Record updated successfully.")
        } catch {
            sendOperationStatus(success: false, message: "Failed to update record: \(error.localizedDescription)")
        }
    }
    
    private func sendOperationStatus(success: BooleanLiteralType, message: String) {
        let payload: [String: Any] = [
            "event": success ? "OPERATION_SUCCESS" : "OPERATION_ERROR",
            "message": message
        ]
        sendJson(payload)
    }
    
    private func sendJson(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let jsonString = String(data: data, encoding: .utf8) else {
            return
        }
        webSocketTask?.send(.string(jsonString)) { error in
            if let error = error {
                print("[RealmDebugger] Failed to send socket message: \(error.localizedDescription)")
            }
        }
    }
    
    public func dispose() {
        isConnected = false
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        notificationTokens.forEach { $0.invalidate() }
        notificationTokens.removeAll()
    }
}
