# Realm Live Database Inspector & Debugger

A high-performance, real-time, **Read-Only** Realm Database Inspector for React Native applications. Stream your Realm file schemas, collections, change logs, and individual records directly to a web browser as they update.

---

## Features

- 📂 **Multi-File Support**: Inspect multiple active `.realm` databases concurrently.
- ⚡ **Real-Time Data Streaming**: Instant updates via WebSockets when database records are inserted, modified, or deleted.
- 🔍 **Dynamic Schema Auditing**: Automatically detects schemas, fields, columns, and relations.
- 👓 **JSON Inspector**: View fully-formatted JSON objects for any record in the database.
- 🔎 **Global Table Search**: Instantly search and filter records on the client side.
- 🛠️ **Auto-Reconnect**: Seamless background recovery if the app or debugger server goes offline.
- 🔒 **Read-Only Mode**: Guarantees zero writes back to your database, ensuring safe debug environments.

---

## 📁 Project Structure

```
realm-debugger/
├── package.json         # Node.js dependencies (express, ws)
├── server.js            # Node/Express WebSocket Server
├── README.md            # Setup and usage guide
├── client/
│   └── realmDebuggerClient.ts   # React Native client helper hook
└── public/
    └── index.html       # Sleek HTML5 / Tailwind CSS Live Dashboard
```

---

## 🚀 Getting Started

### 1. Install Server Dependencies

Navigate to the `realm-debugger` folder and install:

```bash
cd realm-debugger
npm install
```

### 2. Start the Debugger Server

Run the server on your development machine and automatically open the debugger in your default browser:

```bash
npm run realm-debugger
```

Or start the server without automatically opening a browser window:

```bash
npm start
```

The server will start on `http://localhost:3000` (or `http://localhost:5000` in development). Keep this window running in the background.

---

## 🔌 Integration into React Native App

To integrate the debugger with any React Native application using Realm, please follow the detailed steps in the [Integration Guide](./INTEGRATION.md).

### Quick Setup:
1. Install the package in your React Native project:
```bash
npm install react-native-realm-live-debugger --legacy-peer-deps
```

2. Initialize the debugger inside your React component where the database is opened:
```typescript
import React, { useEffect } from 'react';
import { useRealm } from '@realm/react';
import { initRealmDebugger } from 'react-native-realm-live-debugger';

// Inside your component:
const realm = useRealm();

useEffect(() => {
  if (__DEV__ && realm) {
    // Initialize the live debugger
    // Signature: initRealmDebugger(realmInstance, realmConfig, serverUrl?)
    const cleanUp = initRealmDebugger(realm, null);
    return () => cleanUp();
  }
}, [realm]);
```

> [!IMPORTANT]
> **Function Signature:** `initRealmDebugger(realmInstance, realmConfig, serverUrl?)`
> - `realmInstance` — Your active Realm database instance
> - `realmConfig` — Your Realm configuration object (pass `null` if not using dynamic schema features)
> - `serverUrl` *(optional)* — WebSocket URL of the debugger server (defaults to `ws://localhost:5000` in dev mode)
>
> **Do NOT pass a callback function as the 3rd argument** — it expects a `string` (URL), not a function.

3. Start the Debugger Server:

In the root directory of your React Native project, run the following command to start the debugger:
```bash
npx realm-debugger
```
This automatically starts the local backend server and opens the Live Dashboard in your default web browser.

4. Android Port Forwarding (**Required for Android devices**):

If you are running on an Android physical device or emulator, run this command so your phone can reach the debugger server on your PC:
```bash
adb reverse tcp:5000 tcp:5000
```

5. Reload the App:

After the above steps, reload your React Native app:
- Press `r` in the Metro terminal, or
- Shake the device and tap **"Reload"**

You should see `[Debugger] App connected` in the `npx realm-debugger` terminal.

> [!NOTE]
> If testing on an **Android physical device** and `adb reverse` does not work, you can replace `localhost` with your machine's local IP address:
> ```typescript
> const cleanUp = initRealmDebugger(realm, null, 'ws://192.168.1.5:5000');
> ```

---

## ⚠️ Common Pitfalls

| Problem | Cause | Fix |
|:--------|:------|:----|
| App not connecting | Wrong 3rd argument (passing a function instead of a URL string) | Use `initRealmDebugger(realm, config)` — do NOT pass a callback as the 3rd arg |
| App not connecting on Android | Missing port forwarding | Run `adb reverse tcp:5000 tcp:5000` |
| Dashboard shows `appConnected: false` | App hasn't loaded yet or port mismatch | Reload the app and verify the server is running on port `5000` |

---

## 📺 Dashboard Controls

Open `http://localhost:5000` in any web browser:

1. **Left Sidebar**:
   - **Realm Files**: Shows active connected files and status (`online` or `offline`). Select a file to view its schemas.
   - **Schemas**: Select a collection to load its contents into the main view.
2. **Main Table**:
   - Lists all records and columns dynamically.
   - Use the **Search Bar** to filter rows by any value.
3. **JSON Inspector**:
   - Click on any table row to see its fully formatted JSON structure.
4. **Change Event Console**:
   - Real-time logging of all `INSERT`, `UPDATE`, and `DELETE` actions as they occur.
5. **Sync App Button**:
   - Click to request a full refresh from the app if you want to force-align state.
