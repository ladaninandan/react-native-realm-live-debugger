# React Native Realm Live Debugger

[![npm version](https://img.shields.io/npm/v/react-native-realm-live-debugger.svg)](https://www.npmjs.com/package/react-native-realm-live-debugger)
[![license](https://img.shields.io/npm/l/react-native-realm-live-debugger.svg)](https://github.com/ladaninandan/react-native-realm-live-debugger/blob/main/LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/react-native-realm-live-debugger.svg)](https://www.npmjs.com/package/react-native-realm-live-debugger)

**React Native Realm Live Debugger** is a high-performance, real-time **Realm Database Inspector** for React Native applications. It lets you view your Realm database schemas, records, and live changes directly in your web browser while developing — powered by WebSockets for instant updates.

> The best way to debug and inspect your Realm database in React Native. Works with both `realm` and `@realm/react`.

---

## ✨ Features

- 📂 **Multi-File Support** — Inspect multiple active `.realm` databases concurrently
- ⚡ **Real-Time Data Streaming** — Instant updates via WebSockets when records are inserted, modified, or deleted
- 🔍 **Dynamic Schema Auditing** — Automatically detects schemas, fields, columns, and relations
- 👓 **JSON Inspector** — View fully-formatted JSON objects for any record in the database
- 🔎 **Global Table Search** — Instantly search and filter records on the client side
- ➕ **Add & Edit Records** — Create new records and update existing ones directly from the dashboard
- 🛠️ **Auto-Reconnect** — Seamless background recovery if the app or debugger server goes offline
- 🔒 **Safe Debug Mode** — Guarantees zero unintended writes to your database

---

## 🚀 Quick Start

### 1. Install

```bash
npm install react-native-realm-live-debugger
```

### 2. Add to Your React Native App

```typescript
import { useEffect } from 'react';
import { useRealm } from '@realm/react';
import { initRealmDebugger } from 'react-native-realm-live-debugger';

function MyComponent() {
  const realm = useRealm();

  useEffect(() => {
    if (__DEV__ && realm) {
      const cleanUp = initRealmDebugger(realm, null);
      return () => cleanUp();
    }
  }, [realm]);

  return null;
}
```

### 3. Start the Debugger Dashboard

```bash
npx realm-debugger
```

This starts the local server and opens `http://localhost:5000` in your browser automatically.

### 4. Android Port Forwarding (Required)

```bash
adb reverse tcp:5000 tcp:5000
```

### 5. Reload Your App

Press `r` in Metro terminal or shake device → **Reload**. You should see:

```
[Debugger] App connected
```

---

## 📖 API Reference

### `initRealmDebugger(realmInstance, realmConfig, serverUrl?)`

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `realmInstance` | `Realm` | Your active Realm database instance |
| `realmConfig` | `Realm.Configuration \| null` | Realm config object (pass `null` if not using dynamic schema features) |
| `serverUrl` | `string` *(optional)* | WebSocket URL. Defaults to `ws://localhost:5000` in dev mode |

**Returns:** A cleanup function to disconnect the debugger.

> [!WARNING]
> **Do NOT pass a callback function as the 3rd argument.** The 3rd parameter expects a WebSocket URL string. Passing a function will cause a silent connection failure.

---

## 📺 Dashboard Controls

Open `http://localhost:5000` in any web browser:

| Section | Description |
|:--------|:------------|
| **Realm Files** | Shows active connected `.realm` files and their online/offline status |
| **Schemas** | Select a collection to view its records in the main table |
| **Data Table** | Lists all records with columns. Use the search bar to filter rows |
| **JSON Inspector** | Click any row to see its full JSON structure |
| **Change Log** | Real-time log of all `INSERT`, `UPDATE`, and `DELETE` events |
| **Sync App** | Force a full data refresh from the connected app |

---

## ⚠️ Common Pitfalls

| Problem | Cause | Fix |
|:--------|:------|:----|
| App not connecting | Wrong 3rd argument (passing a function instead of URL) | Use `initRealmDebugger(realm, config)` — do NOT pass a callback as 3rd arg |
| App not connecting on Android | Missing port forwarding | Run `adb reverse tcp:5000 tcp:5000` |
| Dashboard shows `appConnected: false` | App hasn't loaded yet or port mismatch | Reload the app and verify server is running on port `5000` |

---

## 📁 Project Structure

```
react-native-realm-live-debugger/
├── package.json                # Package metadata & dependencies
├── server.js                   # Node.js/Express WebSocket server
├── bin/
│   └── cli.js                  # CLI entry point (npx realm-debugger)
├── client/
│   └── realmDebuggerClient.ts  # React Native client integration
├── public/
│   ├── index.html              # Web dashboard UI
│   ├── css/style.css           # Dashboard styles
│   └── js/                     # Dashboard JavaScript modules
├── README.md
├── INTEGRATION.md              # Detailed integration guide
└── LICENSE                     # MIT License
```

---

## 🔌 Advanced Integration

For detailed integration examples including:
- Standard React State & Context setup
- `@realm/react` hooks integration
- Android emulator & physical device configuration
- IP address mapping for wireless debugging

See the full [Integration Guide](./INTEGRATION.md).

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/react-native-realm-live-debugger)
- [GitHub Repository](https://github.com/ladaninandan/react-native-realm-live-debugger)
- [Report Issues](https://github.com/ladaninandan/react-native-realm-live-debugger/issues)
- [Integration Guide](./INTEGRATION.md)

---

**Built with ❤️ by [Nandan Ladani](https://github.com/ladaninandan)**
