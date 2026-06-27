# Realm Live Debugger Client

A Live, Real-Time Realm Database Inspector & Debugger Client for Flutter applications. Connects to the local/hosted server dashboard over WebSockets to view, query, and modify Realm database records in real-time.

## Features

- **Live Data Stream:** View your Realm database tables and records live as they change.
- **Dynamic Schema Inspection:** Automatically reads and displays all Realm schemas/models.
- **Write Operations:** Add, update, and delete records directly from the debugger dashboard.
- **WebSocket Protocol:** Low-latency real-time communication between your Flutter application and the server.

## Installation

Add `realm_live_debugger` to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  realm: ^3.5.0 # matches your Realm version
  realm_live_debugger: ^1.0.5
```

## Usage

Import the client and initialize it in your application. It is recommended to only run the debugger client in debug mode:

```dart
import 'package:flutter/foundation.dart';
import 'package:realm/realm.dart';
import 'package:realm_live_debugger/realm_debugger_client.dart';

void main() {
  final config = Configuration.local([User.schema, Todo.schema]);
  final realm = Realm(config);

  if (kDebugMode) {
    final debugger = RealmDebuggerClient(
      realm,
      serverUrl: 'ws://localhost:5000', // Use ws://10.0.2.2:5000 for Android Emulator
    );
    debugger.start();
  }
  
  runApp(const MyApp());
}
```

## Running the Server Dashboard

Ensure your debugger server is running. You can start it using:

```bash
npx realm-debugger
```

For Android Emulator, remember to run port forwarding:

```bash
adb reverse tcp:5000 tcp:5000
```
