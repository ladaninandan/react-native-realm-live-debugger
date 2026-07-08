/**
 * Realm Live Database Inspector Client for React Native
 *
 * Simply import this file and initialize it with your Realm instance.
 * It will auto-detect schemas and stream updates live to the debugger server.
 */

interface SchemaProperty {
  type: string;
  objectType?: string;
  optional?: boolean;
}

interface RealmSchema {
  name: string;
  primaryKey?: string;
  properties: Record<string, string | SchemaProperty>;
}

// Convert a Realm Object to a clean plain JSON object safely
function serializeRealmObject(obj: any, schema: RealmSchema): any {
  if (!obj) return null;

  const plain: any = {};

  // Always include database ID if present (common in Realm schema designs)
  if (obj._id) {
    plain._id = obj._id.toString ? obj._id.toString() : String(obj._id);
  }

  // Map properties defined in schema
  const propKeys = Object.keys(schema.properties);
  for (const key of propKeys) {
    const val = obj[key];

    if (val === null || val === undefined) {
      plain[key] = null;
    } else if (typeof val === "object") {
      if (val instanceof Date) {
        plain[key] = val.toISOString();
      } else if (
        val.toString &&
        val.constructor &&
        val.constructor.name === "ObjectId"
      ) {
        plain[key] = val.toString();
      } else if (typeof val.map === "function") {
        // Handles Realm.List / Arrays
        plain[key] = Array.from(val).map((item: any) => {
          if (item && typeof item === "object") {
            if (item._id) return item._id.toString();
            return JSON.stringify(item);
          }
          return item;
        });
      } else {
        // Nested relation object
        if (val._id) {
          plain[key] = val._id.toString();
        } else {
          plain[key] = "[Relationship Object]";
        }
      }
    } else {
      plain[key] = val;
    }
  }

  return plain;
}

export function initRealmDebugger(
  initialRealm: any,
  realmConfig: any,
  serverUrl: string = typeof __DEV__ !== "undefined" && __DEV__
    ? "ws://localhost:5000"
    : typeof process !== "undefined" &&
        process.env &&
        process.env.NODE_ENV === "production"
      ? "ws://localhost:3000"
      : "ws://localhost:5000",
) {
  let realm = initialRealm;
  let ws: WebSocket | null = null;
  let isConnected = false;
  let reconnectTimer: any = null;
  const realmFileName = realm.path.split("/").pop() || "default.realm";

  // Auto-format WebSocket URL (ensure ws:// or wss:// prefix)
  let formattedUrl = serverUrl;
  if (!formattedUrl.startsWith("ws://") && !formattedUrl.startsWith("wss://")) {
    if (formattedUrl.startsWith("http://")) {
      formattedUrl = formattedUrl.replace("http://", "ws://");
    } else if (formattedUrl.startsWith("https://")) {
      formattedUrl = formattedUrl.replace("https://", "wss://");
    } else {
      formattedUrl = `ws://${formattedUrl}`;
    }
  }

  console.log(
    `[RealmDebugger] Initializing inspector for file: ${realmFileName}`,
  );

  // Fetch all schemas and active records
  function captureCurrentState() {
    const schemas: RealmSchema[] = realm.schema || [];
    const data: Record<string, any[]> = {};

    schemas.forEach((schema) => {
      try {
        const objects = realm.objects(schema.name);
        data[schema.name] = Array.from(objects).map((obj) =>
          serializeRealmObject(obj, schema),
        );
      } catch (err) {
        console.warn(
          `[RealmDebugger] Failed to read schema data for ${schema.name}:`,
          err,
        );
        data[schema.name] = [];
      }
    });

    return {
      realmFile: realmFileName,
      schemas,
      data,
    };
  }

  // Connect to the WebSocket inspector server
  function connect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);

    console.log(
      `[RealmDebugger] Connecting to inspector server at ${formattedUrl}...`,
    );
    ws = new WebSocket(formattedUrl);

    ws.onopen = () => {
      console.log(
        `[RealmDebugger] Connected to inspector server successfully.`,
      );
      isConnected = true;

      // Send initial connect payload
      const state = captureCurrentState();
      ws?.send(
        JSON.stringify({
          event: "APP_CONNECT",
          ...state,
        }),
      );
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.event === "FORCE_REFRESH") {
          console.log(
            "[RealmDebugger] Force refresh request received from dashboard.",
          );
          sendUpdate("REFRESH", "ForceRefresh");
        } else if (message.event === "ADD_RECORD") {
          const { schemaName, record } = message;
          console.log(
            `[RealmDebugger] Dynamic request to add record to schema "${schemaName}":`,
            record,
          );

          try {
            realm.write(() => {
              const schemas: RealmSchema[] = realm.schema || [];
              const schema = schemas.find((s: any) => s.name === schemaName);
              if (!schema)
                throw new Error(
                  `Schema "${schemaName}" not found in database.`,
                );

              const finalRecord: any = {};
              const properties = schema.properties;

              for (const key of Object.keys(properties)) {
                let propDef = properties[key];
                let propType =
                  typeof propDef === "string"
                    ? propDef
                    : propDef.type || "string";
                let val = record[key];

                if (val === undefined || val === null || val === "") {
                  continue;
                }

                const baseType = propType.endsWith("?")
                  ? propType.slice(0, -1)
                  : propType;

                if (
                  baseType === "objectId" ||
                  (typeof propDef === "object" &&
                    propDef.objectType === "ObjectId") ||
                  key === "_id"
                ) {
                  try {
                    finalRecord[key] = new (
                      realm.constructor as any
                    ).BSON.ObjectId(val);
                  } catch {
                    finalRecord[key] = new (
                      realm.constructor as any
                    ).BSON.ObjectId();
                  }
                } else if (baseType === "date") {
                  const d = new Date(val);
                  if (isNaN(d.getTime())) {
                    throw new Error(
                      `Field "${key}" must be a valid date string.`,
                    );
                  }
                  finalRecord[key] = d;
                } else if (
                  baseType === "int" ||
                  baseType === "double" ||
                  baseType === "float" ||
                  baseType === "number"
                ) {
                  const num = Number(val);
                  if (isNaN(num)) {
                    throw new Error(`Field "${key}" must be a valid number.`);
                  }
                  finalRecord[key] = num;
                } else if (baseType === "bool" || baseType === "boolean") {
                  finalRecord[key] = val === "true" || val === true;
                } else if (
                  baseType === "list" ||
                  baseType.endsWith("[]") ||
                  (typeof propDef === "object" &&
                    (propDef.type === "list" || propDef.type === "array"))
                ) {
                  try {
                    if (typeof val === "string") {
                      if (
                        val.trim().startsWith("[") &&
                        val.trim().endsWith("]")
                      ) {
                        finalRecord[key] = JSON.parse(val);
                      } else {
                        finalRecord[key] = val
                          .split(",")
                          .map((s: string) => s.trim())
                          .filter((s: string) => s.length > 0);
                      }
                    } else if (Array.isArray(val)) {
                      finalRecord[key] = val;
                    } else {
                      finalRecord[key] = [];
                    }
                  } catch {
                    finalRecord[key] = [];
                  }
                } else {
                  finalRecord[key] = val;
                }
              }

              if (schema.primaryKey && !finalRecord[schema.primaryKey]) {
                const pkProp = properties[schema.primaryKey];
                const pkType =
                  typeof pkProp === "string" ? pkProp : pkProp.type || "string";
                if (pkType === "objectId" || schema.primaryKey === "_id") {
                  finalRecord[schema.primaryKey] = new (
                    realm.constructor as any
                  ).BSON.ObjectId();
                }
              }

              realm.create(schemaName, finalRecord);
            });
            console.log(
              `[RealmDebugger] Record added successfully to schema ${schemaName}`,
            );
            ws?.send(
              JSON.stringify({
                event: "OPERATION_SUCCESS",
                message: `Successfully added new record to "${schemaName}".`,
              }),
            );
          } catch (err: any) {
            console.error(`[RealmDebugger] Failed to add record:`, err);
            ws?.send(
              JSON.stringify({
                event: "OPERATION_ERROR",
                message: err.message || String(err),
              }),
            );
          }
        } else if (message.event === "UPDATE_RECORD") {
          const { schemaName, primaryKeyVal, record } = message;
          console.log(
            `[RealmDebugger] Dynamic request to update record in schema "${schemaName}" with PK "${primaryKeyVal}":`,
            record,
          );

          try {
            realm.write(() => {
              const schemas: RealmSchema[] = realm.schema || [];
              const schema = schemas.find((s: any) => s.name === schemaName);
              if (!schema)
                throw new Error(
                  `Schema "${schemaName}" not found in database.`,
                );

              const primaryKey = schema.primaryKey;
              if (!primaryKey)
                throw new Error(
                  `Schema "${schemaName}" does not have a primary key.`,
                );

              // Find the object
              let pkParsed: any = primaryKeyVal;
              const pkProp = schema.properties[primaryKey];
              const pkType =
                typeof pkProp === "string" ? pkProp : pkProp.type || "string";
              if (pkType === "objectId" || primaryKey === "_id") {
                pkParsed = new (realm.constructor as any).BSON.ObjectId(
                  primaryKeyVal,
                );
              } else if (pkType === "int") {
                pkParsed = Number(primaryKeyVal);
              }

              const obj = realm.objectForPrimaryKey(schemaName, pkParsed);
              if (!obj)
                throw new Error(
                  `Record with primary key "${primaryKeyVal}" not found in "${schemaName}".`,
                );

              const properties = schema.properties;

              for (const key of Object.keys(properties)) {
                if (key === primaryKey) continue; // Cannot update primary key field

                let propDef = properties[key];
                let propType =
                  typeof propDef === "string"
                    ? propDef
                    : propDef.type || "string";
                let val = record[key];

                // If optional property is omitted or sent as empty/null, set it to null
                const baseType = propType.endsWith("?")
                  ? propType.slice(0, -1)
                  : propType;
                const isOptional = propType.endsWith("?");

                if (val === undefined || val === null || val === "") {
                  if (isOptional) {
                    (obj as any)[key] = null;
                  }
                  continue;
                }

                if (
                  baseType === "objectId" ||
                  (typeof propDef === "object" &&
                    propDef.objectType === "ObjectId")
                ) {
                  try {
                    (obj as any)[key] = new (
                      realm.constructor as any
                    ).BSON.ObjectId(val);
                  } catch {
                    (obj as any)[key] = null;
                  }
                } else if (baseType === "date") {
                  const d = new Date(val);
                  if (isNaN(d.getTime())) {
                    throw new Error(
                      `Field "${key}" must be a valid date string.`,
                    );
                  }
                  (obj as any)[key] = d;
                } else if (
                  baseType === "int" ||
                  baseType === "double" ||
                  baseType === "float" ||
                  baseType === "number"
                ) {
                  const num = Number(val);
                  if (isNaN(num)) {
                    throw new Error(`Field "${key}" must be a valid number.`);
                  }
                  (obj as any)[key] = num;
                } else if (baseType === "bool" || baseType === "boolean") {
                  (obj as any)[key] = val === "true" || val === true;
                } else if (
                  baseType === "list" ||
                  baseType.endsWith("[]") ||
                  (typeof propDef === "object" &&
                    (propDef.type === "list" || propDef.type === "array"))
                ) {
                  try {
                    if (typeof val === "string") {
                      if (
                        val.trim().startsWith("[") &&
                        val.trim().endsWith("]")
                      ) {
                        (obj as any)[key] = JSON.parse(val);
                      } else {
                        (obj as any)[key] = val
                          .split(",")
                          .map((s: string) => s.trim())
                          .filter((s: string) => s.length > 0);
                      }
                    } else if (Array.isArray(val)) {
                      (obj as any)[key] = val;
                    } else {
                      (obj as any)[key] = [];
                    }
                  } catch {
                    (obj as any)[key] = [];
                  }
                } else {
                  (obj as any)[key] = val;
                }
              }
            });
            console.log(
              `[RealmDebugger] Record updated successfully in schema ${schemaName}`,
            );
            ws?.send(
              JSON.stringify({
                event: "OPERATION_SUCCESS",
                message: `Successfully updated record with key "${primaryKeyVal}" in "${schemaName}".`,
              }),
            );
          } catch (err: any) {
            console.error(`[RealmDebugger] Failed to update record:`, err);
            ws?.send(
              JSON.stringify({
                event: "OPERATION_ERROR",
                message: err.message || String(err),
              }),
            );
          }
        } else if (message.event === "ADD_SCHEMA_COLUMN") {
          const { schemaName, columnName, columnType, optional } = message;
          console.log(
            `[RealmDebugger] Dynamic request to add column "${columnName}" (${columnType}) to schema "${schemaName}"`,
          );

          try {
            const targetClass: any = realmConfig.schema?.find(
              (s: any) => (s.schema ? s.schema.name : s.name) === schemaName,
            );
            if (!targetClass)
              throw new Error(`Schema class for "${schemaName}" not found.`);

            const targetSchema = targetClass.schema || targetClass;

            // Add the property to targetSchema
            if (!targetSchema.properties) {
              targetSchema.properties = {};
            }
            targetSchema.properties[columnName] = optional
              ? `${columnType}?`
              : columnType;

            // Increment schemaVersion
            realmConfig.schemaVersion = (realmConfig.schemaVersion || 0) + 1;

            // Close existing realm
            realm.close();

            // Reopen realm
            const constructor = initialRealm.constructor as any;
            const newRealm = constructor.open
              ? await constructor.open(realmConfig)
              : new constructor(realmConfig);

            // Update references
            realm = newRealm;

            // Re-setup change listeners
            registerListeners();

            console.log(
              `[RealmDebugger] Dynamic column "${columnName}" successfully added. Reopened Realm with schemaVersion ${realmConfig.schemaVersion}`,
            );

            ws?.send(
              JSON.stringify({
                event: "OPERATION_SUCCESS",
                message: `Successfully added column "${columnName}" to schema "${schemaName}" and restarted Realm.`,
              }),
            );

            // Broadcast the new schema state to all browsers
            ws?.send(
              JSON.stringify({
                event: "REALM_CHANGED",
                ...captureCurrentState(),
              }),
            );
          } catch (err: any) {
            console.error(`[RealmDebugger] Failed to add column:`, err);
            ws?.send(
              JSON.stringify({
                event: "OPERATION_ERROR",
                message: err.message || String(err),
              }),
            );
          }
        }
      } catch (err) {
        console.error("[RealmDebugger] Failed parsing incoming message:", err);
      }
    };

    ws.onclose = () => {
      console.log(
        "[RealmDebugger] Connection closed. Retrying in 4 seconds...",
      );
      isConnected = false;
      ws = null;
      reconnectTimer = setTimeout(connect, 4000);
    };

    ws.onerror = (err) => {
      console.log("[RealmDebugger] Connection error:", err);
    };
  }

  // Send an update event to the server
  function sendUpdate(
    changeType: "INSERT" | "UPDATE" | "DELETE" | "REFRESH",
    schemaName: string,
  ) {
    if (ws && isConnected && ws.readyState === WebSocket.OPEN) {
      const state = captureCurrentState();
      ws.send(
        JSON.stringify({
          event: "REALM_CHANGED",
          changeType,
          schemaName,
          ...state,
        }),
      );
    }
  }

  // Register collection change listeners for each schema in Realm
  function registerListeners() {
    const schemas: RealmSchema[] = realm.schema || [];

    schemas.forEach((schema) => {
      try {
        const collection = realm.objects(schema.name);

        collection.addListener((col: any, changes: any) => {
          if (!changes) return;

          // Identify precise change action
          let changeType: "INSERT" | "UPDATE" | "DELETE" | null = null;

          if (changes.insertions && changes.insertions.length > 0) {
            changeType = "INSERT";
          } else if (
            changes.modifications &&
            changes.modifications.length > 0
          ) {
            changeType = "UPDATE";
          } else if (changes.deletions && changes.deletions.length > 0) {
            changeType = "DELETE";
          }

          if (changeType) {
            console.log(
              `[RealmDebugger] Change detected: ${changeType} on schema: ${schema.name}`,
            );
            sendUpdate(changeType, schema.name);
          }
        });
      } catch (err) {
        console.warn(
          `[RealmDebugger] Could not attach change listener to schema ${schema.name}:`,
          err,
        );
      }
    });
  }

  // Run connection & start listeners
  connect();
  registerListeners();

  // Return a cleanup function if developer wants to dismantle it
  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.close();
    }
  };
}
