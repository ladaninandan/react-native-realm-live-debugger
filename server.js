const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");

const PORT =
  process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 5000);
const PUBLIC_DIR = path.join(__dirname, "public");

// 1. Simple HTTP Server serving the public folder
const server = http.createServer((req, res) => {
  // Strip query parameters and hash fragments
  let urlPath = req.url.split("?")[0].split("#")[0];
  if (urlPath === "/") urlPath = "/index.html";

  // Prevent directory traversal by resolving the absolute path safely
  const filePath = path.resolve(PUBLIC_DIR, "." + path.normalize(urlPath));

  // Guard against directory traversal attacks (must reside within PUBLIC_DIR)
  const safePrefix = PUBLIC_DIR + path.sep;
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(safePrefix)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } else {
      let contentType = "text/html";
      if (filePath.endsWith(".js")) contentType = "application/javascript";
      if (filePath.endsWith(".css")) contentType = "text/css";
      if (filePath.endsWith(".json")) contentType = "application/json";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    }
  });
});

// Central cache for connected Realm files
const realmCache = {};
let activeAppConnection = null;
const clients = new Set();

// Decode WebSocket Frame (supports Text and Close frames with client masks)
function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const opCode = firstByte & 0x0f;

  // Close connection frame
  if (opCode === 0x08) {
    return { type: "close", rawLength: 2 };
  }

  // Text frame
  if (opCode !== 0x01) {
    return null;
  }

  const secondByte = buffer[1];
  const isMasked = Boolean((secondByte >>> 7) & 0x01);
  let payloadLength = secondByte & 0x7f;

  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    // Lower 4 bytes for large lengths
    payloadLength = buffer.readUInt32BE(6);
    offset = 10;
  }

  // Client frames must be masked
  if (!isMasked) return null;

  if (buffer.length < offset + 4 + payloadLength) return null;

  const maskingKey = buffer.slice(offset, offset + 4);
  offset += 4;

  const payload = buffer.slice(offset, offset + payloadLength);
  const decoded = Buffer.alloc(payloadLength);
  for (let i = 0; i < payloadLength; i++) {
    decoded[i] = payload[i] ^ maskingKey[i % 4];
  }

  return {
    type: "text",
    data: decoded.toString("utf8"),
    rawLength: offset + payloadLength,
  };
}

// Encode WebSocket Frame to send Text frame to client
function encodeFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;
  let header;

  if (len <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }

  return Buffer.concat([header, payload]);
}

// Broadcast to browser clients only
function broadcastToBrowsers(message) {
  const frame = encodeFrame(JSON.stringify(message));
  for (const client of clients) {
    if (client !== activeAppConnection) {
      try {
        client.write(frame);
      } catch (err) {
        clients.delete(client);
      }
    }
  }
}

// Handle WebSocket JSON payloads
function handleMessage(socket, rawData) {
  try {
    const data = JSON.parse(rawData);

    switch (data.event) {
      case "APP_CONNECT":
        console.log(`[Debugger] App connected. Monitoring: ${data.realmFile}`);
        activeAppConnection = socket;

        realmCache[data.realmFile] = {
          realmFile: data.realmFile,
          schemas: data.schemas || [],
          data: data.data || {},
          lastUpdated: new Date().toLocaleTimeString(),
          status: "online",
        };

        broadcastToBrowsers({
          event: "REALM_UPDATED",
          realmFile: data.realmFile,
          cache: realmCache,
        });
        break;

      case "REALM_CHANGED":
        console.log(`[Debugger] Change event received for: ${data.realmFile}`);
        if (realmCache[data.realmFile]) {
          realmCache[data.realmFile].data = data.data || {};
          realmCache[data.realmFile].schemas = data.schemas || [];
          realmCache[data.realmFile].lastUpdated =
            new Date().toLocaleTimeString();
        } else {
          realmCache[data.realmFile] = {
            realmFile: data.realmFile,
            schemas: data.schemas || [],
            data: data.data || {},
            lastUpdated: new Date().toLocaleTimeString(),
            status: "online",
          };
        }

        broadcastToBrowsers({
          event: "REALM_UPDATED",
          realmFile: data.realmFile,
          cache: realmCache,
          changeLog: {
            timestamp: new Date().toLocaleTimeString(),
            type: data.changeType || "UPDATE",
            schemaName: data.schemaName || "Unknown",
          },
        });
        break;

      case "BROWSER_CONNECT":
        console.log("[Debugger] Web browser inspector page connected.");
        try {
          socket.write(
            encodeFrame(
              JSON.stringify({
                event: "INITIAL_STATE",
                cache: realmCache,
                appConnected: activeAppConnection !== null,
              }),
            ),
          );
        } catch (err) {
          console.error(
            "[Debugger] Failed to send state to browser:",
            err.message,
          );
        }
        break;

      case "REQUEST_REFRESH":
        console.log("[Debugger] Browser requested full sync from app.");
        if (activeAppConnection) {
          try {
            activeAppConnection.write(
              encodeFrame(JSON.stringify({ event: "FORCE_REFRESH" })),
            );
          } catch (err) {
            console.error(
              "[Debugger] Failed to forward sync request:",
              err.message,
            );
          }
        }
        break;

      case "ADD_RECORD":
        console.log(
          `[Debugger] Browser requested to add record in schema: ${data.schemaName}`,
        );
        if (activeAppConnection) {
          try {
            activeAppConnection.write(
              encodeFrame(
                JSON.stringify({
                  event: "ADD_RECORD",
                  schemaName: data.schemaName,
                  record: data.record,
                }),
              ),
            );
          } catch (err) {
            console.error(
              "[Debugger] Failed to forward add record request:",
              err.message,
            );
          }
        }
        break;

      case "UPDATE_RECORD":
        console.log(
          `[Debugger] Browser requested to update record in schema: ${data.schemaName}`,
        );
        if (activeAppConnection) {
          try {
            activeAppConnection.write(
              encodeFrame(
                JSON.stringify({
                  event: "UPDATE_RECORD",
                  schemaName: data.schemaName,
                  primaryKeyVal: data.primaryKeyVal,
                  record: data.record,
                }),
              ),
            );
          } catch (err) {
            console.error(
              "[Debugger] Failed to forward update record request:",
              err.message,
            );
          }
        }
        break;

      case "ADD_SCHEMA_COLUMN":
        console.log(
          `[Debugger] Browser requested to add new column to schema: ${data.schemaName}`,
        );
        if (activeAppConnection) {
          try {
            activeAppConnection.write(
              encodeFrame(
                JSON.stringify({
                  event: "ADD_SCHEMA_COLUMN",
                  schemaName: data.schemaName,
                  columnName: data.columnName,
                  columnType: data.columnType,
                  optional: data.optional,
                }),
              ),
            );
          } catch (err) {
            console.error(
              "[Debugger] Failed to forward add schema column request:",
              err.message,
            );
          }
        }
        break;

      case "OPERATION_SUCCESS":
        console.log(
          "[Debugger] Operation succeeded on app client. Notifying browser.",
        );
        broadcastToBrowsers({
          event: "OPERATION_SUCCESS",
          message: data.message,
        });
        break;

      case "OPERATION_ERROR":
        console.log(
          `[Debugger] Operation failed on app client: ${data.message}`,
        );
        broadcastToBrowsers({
          event: "OPERATION_ERROR",
          message: data.message,
        });
        break;
    }
  } catch (err) {
    console.error("[Debugger] JSON parse error:", err.message);
  }
}

// 2. Attach WebSocket connection upgrades
server.on("upgrade", (req, socket, head) => {
  if (req.headers["upgrade"] !== "websocket") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  const acceptKey = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`,
  );

  clients.add(socket);
  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const frame = decodeFrame(buffer);
      if (!frame) break;

      buffer = buffer.slice(frame.rawLength || buffer.length);

      if (frame.type === "close") {
        socket.end();
        break;
      }

      if (frame.type === "text") {
        handleMessage(socket, frame.data);
      }
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    if (socket === activeAppConnection) {
      console.log("[Debugger] React Native App disconnected.");
      activeAppConnection = null;

      Object.keys(realmCache).forEach((key) => {
        realmCache[key].status = "offline";
      });

      broadcastToBrowsers({
        event: "APP_DISCONNECTED",
        cache: realmCache,
      });
    }
  });

  socket.on("error", (err) => {
    console.log("[Debugger] Connection closed with error:", err.message);
    clients.delete(socket);
  });
});

server.listen(PORT, () => {
  console.log(
    `\n🚀 Realm Live Debugger Server running at http://localhost:${PORT}`,
  );
  console.log(
    `📺 Open http://localhost:${PORT} in your browser to inspect database.\n`,
  );
});
