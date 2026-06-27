/**
 * Tab Router for Realm Live Debugger
 */

class Router {
  constructor() {
    this.currentTab = "databases"; // 'databases' | 'logs' | 'schema'
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  switchTab(tabId) {
    if (this.currentTab === tabId) return;
    this.currentTab = tabId;

    // Render / hide DOM containers
    const tabs = ["databases", "logs", "schema"];
    tabs.forEach((tab) => {
      const el = document.getElementById(`content-${tab}`);
      const btn = document.getElementById(`tab-${tab}`);

      if (tab === tabId) {
        if (el) el.classList.remove("hidden");
        if (btn) {
          btn.className =
            "px-5 py-3.5 text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer border-indigo-500 text-white";
        }
      } else {
        if (el) el.classList.add("hidden");
        if (btn) {
          btn.className =
            "px-5 py-3.5 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition flex items-center gap-2 cursor-pointer";
        }
      }
    });

    // Notify listeners
    this.listeners.forEach((callback) => callback(tabId));
  }
}

export const router = new Router();
