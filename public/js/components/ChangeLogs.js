/**
 * ChangeLogs Component - Renders live change logs and system operations stream
 */
import { store } from "../store.js";

export function initChangeLogs() {
  const clearBtn = document.querySelector('[onclick="clearChangeLogs()"]');
  if (clearBtn) {
    // Remove inline onclick and bind listener
    clearBtn.removeAttribute("onclick");
    clearBtn.addEventListener("click", () => {
      store.clearLogs();
    });
  }

  // Subscribe to updates to render logs selectively
  store.subscribeSelector(
    (state) => state.logs,
    () => {
      renderLogs(store.state);
    },
  );
}

function renderLogs(state) {
  const container = document.getElementById("changeLogConsole");
  if (!container) return;

  const { logs } = state;

  if (logs.length === 0) {
    container.innerHTML =
      '<div class="text-slate-500 italic">Listening for live insert, update, and delete events...</div>';
    return;
  }

  container.innerHTML = "";
  logs.forEach((log) => {
    const logLine = document.createElement("div");
    logLine.className =
      "flex items-center gap-3 font-mono text-[11px] py-1 hover:bg-slate-900/40 px-2 rounded border border-transparent hover:border-slate-800 transition";

    const timeSpan = `<span class="text-slate-500">[${log.timestamp}]</span>`;

    let badgeColor = "bg-slate-800 text-slate-400";
    if (log.source === "APP_CLIENT") {
      badgeColor =
        "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20";
    } else if (log.type === "success") {
      badgeColor = "bg-green-500/15 text-green-400 border border-green-500/20";
    } else if (log.type === "error") {
      badgeColor = "bg-red-500/15 text-red-400 border border-red-500/20";
    }

    const sourceSpan = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${badgeColor}">${log.source}</span>`;
    const messageSpan = `<span class="text-slate-350">${log.message}</span>`;

    logLine.innerHTML = `${timeSpan} ${sourceSpan} ${messageSpan}`;
    container.appendChild(logLine);
  });

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Bind to window to satisfy any legacy callbacks if needed
window.clearChangeLogs = () => store.clearLogs();
