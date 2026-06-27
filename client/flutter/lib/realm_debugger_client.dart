import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:realm/realm.dart';

/// A Live, Real-Time Read-Only (and Write-Capable) Database Debugger Client 
/// for Flutter applications using MongoDB Realm.
/// 
/// Connects your active Realm instance directly to the `realm-debugger` 
/// dashboard over WebSockets.
class RealmDebuggerClient {
  final Realm realm;
  final String serverUrl;
  WebSocket? _socket;
  bool _isConnected = false;
  final List<StreamSubscription> _subscriptions = [];

  RealmDebuggerClient(this.realm, {this.serverUrl = 'ws://localhost:5000'});

  /// Connects to the WebSocket server and starts streaming database changes.
  void start() {
    _connect();
  }

  Future<void> _connect() async {
    try {
      _socket = await WebSocket.connect(serverUrl);
      _isConnected = true;
      print('[RealmDebugger] Connected to debugger server.');

      // Send initial state
      _sendInitialState();

      // Listen for incoming control messages from dashboard
      _socket!.listen(
        (data) {
          if (data is String) {
            _handleMessage(data);
          }
        },
        onDone: () {
          _handleDisconnect();
        },
        onError: (err) {
          print('[RealmDebugger] WebSocket error: $err');
          _handleDisconnect();
        },
      );

      // Subscribe to changes on all collections
      _setupChangeListeners();
    } catch (e) {
      print('[RealmDebugger] Failed to connect: $e. Retrying in 5 seconds...');
      Future.delayed(const Duration(seconds: 5), () {
        if (!_isConnected) _connect();
      });
    }
  }

  void _handleDisconnect() {
    _isConnected = false;
    _socket = null;
    for (var sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();
    print('[RealmDebugger] Disconnected from server. Reconnecting in 5 seconds...');
    Future.delayed(const Duration(seconds: 5), () {
      if (!_isConnected) _connect();
    });
  }

  void _sendInitialState() {
    if (_socket == null || !_isConnected) return;

    final schemasJson = _serializeSchemas();
    final dataJson = _serializeAllData();

    final payload = {
      'event': 'APP_CONNECT',
      'realmFile': realm.config.path.split(Platform.pathSeparator).last,
      'schemas': schemasJson,
      'data': dataJson,
    };

    _socket!.add(jsonEncode(payload));
  }

  List<Map<String, dynamic>> _serializeSchemas() {
    return realm.schema.map((schema) {
      final properties = schema.properties.map((prop) {
        return {
          'name': prop.name,
          'type': prop.type.name,
          'optional': prop.optional,
          'primaryKey': prop.primaryKey,
        };
      }).toList();

      return {
        'name': schema.name,
        'properties': properties,
      };
    }).toList();
  }

  Map<String, List<Map<String, dynamic>>> _serializeAllData() {
    final result = <String, List<Map<String, dynamic>>>{};
    for (final schema in realm.schema) {
      final objects = realm.dynamic.all(schema.name);
      result[schema.name] = objects.map((obj) => _serializeObject(obj, schema)).toList();
    }
    return result;
  }

  Map<String, dynamic> _serializeObject(DynamicRealmObject obj, SchemaObject schema) {
    final map = <String, dynamic>{};
    for (final prop in schema.properties) {
      final name = prop.name;
      try {
        final val = obj.dynamic.get(name);
        if (val == null) {
          map[name] = null;
        } else if (val is DateTime) {
          map[name] = val.toIso8601String();
        } else if (val is DynamicRealmObject) {
          final targetSchema = realm.schema.singleWhere((s) => s.name == val.dynamic.type);
          final pkName = targetSchema.primaryKey;
          if (pkName != null) {
            map[name] = {
              '__type': val.dynamic.type,
              '__primaryKey': val.dynamic.get(pkName)?.toString(),
            };
          } else {
            map[name] = '[Link: ${val.dynamic.type}]';
          }
        } else if (val is List) {
          map[name] = val.map((item) {
            if (item is DynamicRealmObject) {
              return '[Link: ${item.dynamic.type}]';
            }
            return item;
          }).toList();
        } else {
          map[name] = val;
        }
      } catch (e) {
        map[name] = '[Error: $e]';
      }
    }
    return map;
  }

  void _setupChangeListeners() {
    for (final schema in realm.schema) {
      final results = realm.dynamic.all(schema.name);
      final sub = results.changes.listen((changes) {
        _sendChangeUpdate(schema.name);
      });
      _subscriptions.add(sub);
    }
  }

  void _sendChangeUpdate(String schemaName) {
    if (_socket == null || !_isConnected) return;

    final schemasJson = _serializeSchemas();
    final dataJson = _serializeAllData();

    final payload = {
      'event': 'REALM_CHANGED',
      'realmFile': realm.config.path.split(Platform.pathSeparator).last,
      'changeType': 'UPDATE',
      'schemaName': schemaName,
      'schemas': schemasJson,
      'data': dataJson,
    };

    _socket!.add(jsonEncode(payload));
  }

  void _handleMessage(String jsonStr) {
    try {
      final message = jsonDecode(jsonStr);
      final event = message['event'];

      if (event == 'FORCE_REFRESH') {
        _sendInitialState();
      } else if (event == 'ADD_RECORD') {
        _handleAddRecord(message['schemaName'], message['record']);
      } else if (event == 'UPDATE_RECORD') {
        _handleUpdateRecord(message['schemaName'], message['primaryKeyVal'], message['record']);
      }
    } catch (e) {
      print('[RealmDebugger] Error handling control message: $e');
    }
  }

  void _handleAddRecord(String schemaName, Map<String, dynamic> record) {
    try {
      realm.write(() {
        final sanitizedRecord = _sanitizeIncomingRecord(schemaName, record);
        realm.dynamic.create(schemaName, sanitizedRecord);
      });
      _sendOperationStatus(true, 'Record added successfully.');
    } catch (e) {
      _sendOperationStatus(false, 'Failed to add record: $e');
    }
  }

  void _handleUpdateRecord(String schemaName, dynamic pkVal, Map<String, dynamic> record) {
    try {
      final schema = realm.schema.singleWhere((s) => s.name == schemaName);
      final pkName = schema.primaryKey;
      if (pkName == null) {
        throw 'Table does not have a primary key.';
      }

      final obj = realm.dynamic.find(schemaName, pkVal);
      if (obj == null) {
        throw 'Record not found.';
      }

      realm.write(() {
        final sanitizedRecord = _sanitizeIncomingRecord(schemaName, record);
        sanitizedRecord.forEach((key, value) {
          if (key != pkName) {
            obj.dynamic.set(key, value);
          }
        });
      });
      _sendOperationStatus(true, 'Record updated successfully.');
    } catch (e) {
      _sendOperationStatus(false, 'Failed to update record: $e');
    }
  }

  Map<String, dynamic> _sanitizeIncomingRecord(String schemaName, Map<String, dynamic> record) {
    final schema = realm.schema.singleWhere((s) => s.name == schemaName);
    final sanitized = <String, dynamic>{};

    for (final entry in record.entries) {
      final key = entry.key;
      final val = entry.value;

      final prop = schema.properties.firstWhere((p) => p.name == key);
      if (val == null) {
        sanitized[key] = null;
      } else if (prop.type == RealmPropertyType.timestamp) {
        sanitized[key] = DateTime.parse(val.toString());
      } else if (prop.type == RealmPropertyType.int) {
        sanitized[key] = int.parse(val.toString());
      } else if (prop.type == RealmPropertyType.double) {
        sanitized[key] = double.parse(val.toString());
      } else if (prop.type == RealmPropertyType.bool) {
        sanitized[key] = val == true || val.toString().toLowerCase() == 'true';
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  void _sendOperationStatus(bool success, String msg) {
    if (_socket == null || !_isConnected) return;
    final payload = {
      'event': success ? 'OPERATION_SUCCESS' : 'OPERATION_ERROR',
      'message': msg,
    };
    _socket!.add(jsonEncode(payload));
  }

  /// Closes the connection and cancels all database subscriptions.
  void dispose() {
    _isConnected = false;
    _socket?.close();
    for (var sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();
  }
}
