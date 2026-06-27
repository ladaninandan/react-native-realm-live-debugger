#!/usr/bin/env node

const { exec } = require("child_process");
const path = require("path");

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
