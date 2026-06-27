/**
 * Global State Store for Realm Live Debugger
 */

class Store {
  constructor() {
    this.state = {
      currentCache: {},
      selectedFile: null,
      selectedSchema: null,
      activeRecord: null,
      logs: [],
      status: "offline", // 'offline' | 'connecting' | 'online'
      statusText: "Connecting to Inspector...",
      topRecordCount: 0,
      lastUpdatedTime: "-",
      schemaSearchQuery: "",
      tableSearchQuery: "",
    };

    this.subscribers = new Set();
    this.socket = null;
  }

  // Register listener for state changes
  subscribe(callback) {
    this.subscribers.add(callback);
    // Return unsubscribe function
    return () => this.subscribers.delete(callback);
  }

  // Selective subscription utilizing state selectors and shallow comparisons
  subscribeSelector(selector, callback) {
    let lastSlice = selector(this.state);
    const wrapper = (state) => {
      const newSlice = selector(state);
      if (!this.shallowEqual(lastSlice, newSlice)) {
        lastSlice = newSlice;
        callback(newSlice);
      }
    };
    this.subscribers.add(wrapper);
    return () => this.subscribers.delete(wrapper);
  }

  // Shallow comparison helper to detect object updates
  shallowEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (
      typeof a !== "object" ||
      a === null ||
      typeof b !== "object" ||
      b === null
    )
      return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (
        !Object.prototype.hasOwnProperty.call(b, keysA[i]) ||
        !Object.is(a[keysA[i]], b[keysA[i]])
      ) {
        return false;
      }
    }
    return true;
  }

  // Update state and notify subscribers
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.subscribers.forEach((callback) => callback(this.state));
  }

  // Connect to the WebSocket Inspector Server
  connectInspector() {
    this.setState({
      status: "connecting",
      statusText: "Connecting to Inspector...",
    });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socketUrl = `${protocol}//${window.location.host}`;

    console.log(
      `[Dashboard] Connecting to WebSocket server at ${socketUrl}...`,
    );
    this.socket = new WebSocket(socketUrl);

    this.socket.onopen = () => {
      console.log("[Dashboard] Connected to WebSocket server.");
      this.setState({ status: "online", statusText: "Dashboard Connected" });
      this.addLog("SYSTEM", "Connected to Inspector Server", "info");
      // Register browser connection and fetch initial cached state
      this.socket.send(JSON.stringify({ event: "BROWSER_CONNECT" }));
      // Automatically request a full refresh from the App client
      this.requestFullRefresh();
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleSocketMessage(message);
      } catch (err) {
        console.error("[Dashboard] Failed to parse message:", err);
      }
    };

    this.socket.onclose = () => {
      console.warn("[Dashboard] Connection closed. Retrying in 4 seconds...");
      this.setState({
        status: "offline",
        statusText: "Connection Lost. Re-connecting...",
      });
      this.addLog("SYSTEM", "Connection to Inspector Server lost", "error");
      setTimeout(() => this.connectInspector(), 4000);
    };

    this.socket.onerror = (err) => {
      console.error("[Dashboard] WebSocket error:", err);
    };
  }

  handleSocketMessage(message) {
    console.log(
      "[Dashboard] Received WebSocket event:",
      message.event,
      message,
    );

    switch (message.event) {
      case "INITIAL_STATE":
      case "CACHE_UPDATE":
        this.handleCacheUpdate(message.cache);
        break;

      case "APP_STATUS":
        this.handleAppStatus(message);
        break;

      case "APP_DISCONNECTED":
        this.handleAppDisconnected();
        break;

      case "REALM_UPDATED":
      case "REALM_CHANGED":
        this.handleRealmChanged(message);
        break;

      case "OPERATION_SUCCESS":
        this.handleOperationSuccess(message);
        break;

      case "OPERATION_ERROR":
        this.handleOperationError(message);
        break;

      default:
        console.warn(`[Dashboard] Unknown event: ${message.event}`);
    }
  }

  handleCacheUpdate(cache) {
    const files = Object.keys(cache);
    let nextFile = this.state.selectedFile;

    // Auto-select first active file if none selected
    if (!nextFile && files.length > 0) {
      const activeFile = files.find((f) => cache[f].status === "online");
      nextFile = activeFile || files[0];
    }

    let nextSchema = this.state.selectedSchema;
    if (nextFile && cache[nextFile]) {
      const schemas = cache[nextFile].schemas || [];
      if (
        schemas.length > 0 &&
        (!nextSchema || !schemas.find((s) => s.name === nextSchema))
      ) {
        nextSchema = schemas[0].name;
      }
    }

    this.setState({
      currentCache: cache,
      selectedFile: nextFile,
      selectedSchema: nextSchema,
      lastUpdatedTime: new Date().toLocaleTimeString(),
    });

    this.updateRecordCount();
  }

  handleAppStatus(message) {
    const { status, realmFile } = message;
    this.addLog(
      "APP_CLIENT",
      `React Native App is now ${status.toUpperCase()} (monitoring: ${realmFile || "none"})`,
      "info",
    );
  }

  handleAppDisconnected() {
    this.addLog("APP_CLIENT", "React Native App disconnected", "error");

    // Mark files as offline
    const updatedCache = { ...this.state.currentCache };
    Object.keys(updatedCache).forEach((fileName) => {
      updatedCache[fileName].status = "offline";
    });

    this.setState({
      currentCache: updatedCache,
    });
  }

  handleRealmChanged(message) {
    const { changeType, schemaName, changeLog, cache } = message;

    const type = changeLog ? changeLog.type : changeType || "UPDATE";
    const schema = changeLog ? changeLog.schemaName : schemaName || "all";

    this.addLog(
      "APP_CLIENT",
      `Realm change detected: ${type} on schema "${schema}"`,
      type === "DELETE" ? "error" : type === "INSERT" ? "success" : "info",
    );

    // Keep active record reference updated if it still exists
    let updatedActiveRecord = this.state.activeRecord;
    if (updatedActiveRecord && schema === this.state.selectedSchema) {
      const pkName = this.getPrimaryKeyField(schema);
      if (pkName && cache[this.state.selectedFile]) {
        const list = cache[this.state.selectedFile].data[schema] || [];
        const found = list.find(
          (r) => String(r[pkName]) === String(updatedActiveRecord[pkName]),
        );
        updatedActiveRecord = found || null;
      }
    }

    this.setState({
      currentCache: cache,
      activeRecord: updatedActiveRecord,
      lastUpdatedTime: new Date().toLocaleTimeString(),
    });

    this.updateRecordCount();
  }

  handleOperationSuccess(message) {
    this.addLog("OPERATION", message.message, "success");
    if (window.showToast) {
      window.showToast("Success", message.message, "success");
    }
    // Close active modal
    if (window.closeAddColumnModal) window.closeAddColumnModal();
    if (window.closeEditRecordModal) window.closeEditRecordModal();
  }

  handleOperationError(message) {
    this.addLog("OPERATION", `Error: ${message.message}`, "error");
    if (window.showToast) {
      window.showToast("Operation Failed", message.message, "error");
    }
    if (window.showModalError) {
      window.showModalError(message.message);
    }
  }

  // Trigger cache refresh on client React Native app
  requestFullRefresh() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.addLog(
        "SYSTEM",
        "Requesting force refresh from App client...",
        "info",
      );
      this.socket.send(JSON.stringify({ event: "REQUEST_REFRESH" }));
      if (window.showToast) {
        window.showToast(
          "Sync Sent",
          "Requested full database refresh from React Native app.",
          "info",
        );
      }
    } else {
      if (window.showToast) {
        window.showToast("Error", "Debugger server offline.", "error");
      }
    }
  }

  // Send add record request
  sendAddRecord(schemaName, record) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: "ADD_RECORD",
          schemaName,
          record,
        }),
      );
    }
  }

  // Send update record request
  sendUpdateRecord(schemaName, primaryKeyVal, record) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: "UPDATE_RECORD",
          schemaName,
          primaryKeyVal,
          record,
        }),
      );
    }
  }

  // Send add schema column request
  sendAddSchemaColumn(schemaName, columnName, columnType, optional) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: "ADD_SCHEMA_COLUMN",
          schemaName,
          columnName,
          columnType,
          optional,
        }),
      );
    }
  }

  // Add system / action log to console stream list
  addLog(source, message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = { timestamp, source, message, type };
    this.setState({ logs: [...this.state.logs, newLog] });
  }

  clearLogs() {
    this.setState({ logs: [] });
  }

  // Utilities
  updateRecordCount() {
    const { currentCache, selectedFile, selectedSchema } = this.state;
    if (selectedFile && selectedSchema && currentCache[selectedFile]) {
      const records = currentCache[selectedFile].data[selectedSchema] || [];
      this.setState({ topRecordCount: records.length });
    } else {
      this.setState({ topRecordCount: 0 });
    }
  }

  getPrimaryKeyField(schemaName) {
    const { currentCache, selectedFile } = this.state;
    if (!selectedFile || !currentCache[selectedFile]) return null;
    const schemas = currentCache[selectedFile].schemas || [];
    const schema = schemas.find((s) => s.name === schemaName);
    return schema ? schema.primaryKey : null;
  }
}

// Single instance of store
export const store = new Store();
