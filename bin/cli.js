#!/usr/bin/env node

const { exec } = require("child_process");
const path = require("path");

// Parse CLI arguments to find a custom port
let customPort = null;
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if ((arg === "--port" || arg === "-p") && process.argv[i + 1]) {
    const val = parseInt(process.argv[i + 1], 10);
    if (!isNaN(val) && val > 0 && val <= 65535) {
      customPort = val;
      break;
    }
  } else if (arg.startsWith("--") && !isNaN(parseInt(arg.slice(2), 10))) {
    const val = parseInt(arg.slice(2), 10);
    if (val > 0 && val <= 65535) {
      customPort = val;
      break;
    }
  } else if (arg.startsWith("-") && !isNaN(parseInt(arg.slice(1), 10))) {
    const val = parseInt(arg.slice(1), 10);
    if (val > 0 && val <= 65535) {
      customPort = val;
      break;
    }
  } else if (!isNaN(parseInt(arg, 10))) {
    const val = parseInt(arg, 10);
    if (val > 0 && val <= 65535) {
      customPort = val;
      break;
    }
  }
}
if (customPort) {
  process.env.PORT = customPort.toString();
}

// 1. Run the main server script
require("../server.js");

const PORT =
  process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 5000);
const url = `http://localhost:${PORT}`;
console.log(`\n🌍 Launching web browser to inspect Realm Database...`);

// 2. Select platform-specific command to launch the browser
const startCommand =
  process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open";

// 3. Delay browser launch by 1 second to ensure Server port is bound
setTimeout(() => {
  exec(`${startCommand} ${url}`, (err) => {
    if (err) {
      console.log(
        `[Debugger] Could not launch browser automatically. Please visit ${url} manually.`,
      );
    }
  });
}, 1000);
