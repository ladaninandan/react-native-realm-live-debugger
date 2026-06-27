/**
 * Sidebar Component - Renders Realm files list and schemas list
 */
import { store } from "../store.js";

export function initSidebar() {
  const schemaSearch = document.getElementById("schemaSearchInput");
  if (schemaSearch) {
    schemaSearch.addEventListener("input", (e) => {
      store.setState({ schemaSearchQuery: e.target.value });
    });
  }

  // Subscribe to state updates to render selectively
  store.subscribeSelector(
    (state) => ({
      currentCache: state.currentCache,
      selectedFile: state.selectedFile,
      selectedSchema: state.selectedSchema,
      schemaSearchQuery: state.schemaSearchQuery,
    }),
    () => {
      renderRealmFiles(store.state);
      renderSchemasList(store.state);
    },
  );
}

function renderRealmFiles(state) {
  const list = document.getElementById("realmFilesList");
  if (!list) return;

  list.innerHTML = "";
  const fileNames = Object.keys(state.currentCache);

  if (fileNames.length === 0) {
    list.innerHTML = `
      <div class="text-xs text-slate-500 italic p-3 text-center bg-slate-900/30 rounded border border-slate-800">
        No Realm files detected
      </div>`;
    return;
  }

  fileNames.forEach((fileName) => {
    const file = state.currentCache[fileName];
    const isActive = state.selectedFile === fileName;

    const btn = document.createElement("button");
    btn.className = `w-full text-left p-3 rounded-lg border transition flex flex-col gap-1 cursor-pointer ${
      isActive
        ? "bg-indigo-600/10 border-indigo-500 text-slate-100"
        : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300"
    }`;

    btn.onclick = () => selectRealmFile(fileName, state);

    const statusBadge =
      file.status === "online"
        ? '<span class="w-1.5 h-1.5 rounded-full bg-green-400 inline-block mr-1"></span>'
        : '<span class="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block mr-1"></span>';

    btn.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <span class="font-semibold text-xs truncate max-w-[180px]">${fileName}</span>
        <span class="text-[10px] uppercase font-bold flex items-center ${file.status === "online" ? "text-green-400" : "text-slate-500"}">
          ${statusBadge} ${file.status || "offline"}
        </span>
      </div>
      <div class="flex items-center justify-between w-full text-[10px] text-slate-400">
        <span>Schemas: ${file.schemas.length}</span>
        <span>Last Sync: ${file.lastUpdated || "-"}</span>
      </div>
    `;
    list.appendChild(btn);
  });
}

function renderSchemasList(state) {
  const list = document.getElementById("schemasList");
  if (!list) return;

  list.innerHTML = "";

  if (!state.selectedFile) {
    list.innerHTML = `
      <div class="text-xs text-slate-500 italic p-3 text-center bg-slate-900/30 rounded border border-slate-800">
        Select a Realm file to view schemas
      </div>`;
    return;
  }

  const file = state.currentCache[state.selectedFile];
  if (!file || !file.schemas || file.schemas.length === 0) {
    list.innerHTML = `
      <div class="text-xs text-slate-500 italic p-3 text-center bg-slate-900/30 rounded border border-slate-800">
        No schemas found in this file
      </div>`;
    return;
  }

  const query = state.schemaSearchQuery.toLowerCase().trim();
  const filteredSchemas = file.schemas.filter((schema) => {
    if (!query) return true;
    return schema.name.toLowerCase().includes(query);
  });

  if (filteredSchemas.length === 0) {
    list.innerHTML = `
      <div class="text-xs text-slate-500 italic p-3 text-center bg-slate-900/30 rounded border border-slate-800">
        No schemas match your filter
      </div>`;
    return;
  }

  filteredSchemas.forEach((schema) => {
    const schemaName = schema.name;
    const count = ((file.data && file.data[schemaName]) || []).length;
    const isActive = state.selectedSchema === schemaName;

    const btn = document.createElement("button");
    btn.className = `w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between transition border text-xs cursor-pointer ${
      isActive
        ? "bg-slate-800 border-indigo-500/50 text-indigo-400 font-semibold"
        : "bg-transparent border-transparent hover:bg-slate-900/60 hover:border-slate-800/80 text-slate-400 hover:text-slate-200"
    }`;

    btn.onclick = () => selectSchemaTable(schemaName, state);

    btn.innerHTML = `
      <span class="truncate pr-2">${schemaName}</span>
      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isActive
          ? "bg-indigo-600/20 text-indigo-400"
          : "bg-slate-800 text-slate-500"
      }">${count}</span>
    `;
    list.appendChild(btn);
  });
}

function selectRealmFile(fileName, state) {
  const currentSearch = document.getElementById("schemaSearchInput");
  if (currentSearch) currentSearch.value = "";

  store.setState({
    selectedFile: fileName,
    selectedSchema: null,
    activeRecord: null,
    schemaSearchQuery: "",
    tableSearchQuery: "",
  });

  // Reset breadcrumbs
  const navSelectedPath = document.getElementById("navSelectedPath");
  if (navSelectedPath) navSelectedPath.innerText = fileName;

  // Reset buttons
  document.getElementById("copyJsonButton").disabled = true;
  document.getElementById("editRecordButton").disabled = true;
  document.getElementById("addRecordButton").disabled = true;
  document.getElementById("addColumnButton").disabled = true;
  document.getElementById("jsonViewer").innerText =
    "Select a row to inspect its full JSON content.";
}

function selectSchemaTable(schemaName, state) {
  store.setState({
    selectedSchema: schemaName,
    activeRecord: null,
    tableSearchQuery: "",
  });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  // Update breadcrumbs
  const navSelectedPath = document.getElementById("navSelectedPath");
  if (navSelectedPath)
    navSelectedPath.innerText = `${state.selectedFile} > ${schemaName}`;

  // Enable buttons
  document.getElementById("addRecordButton").disabled = false;
  document.getElementById("addColumnButton").disabled = false;
  document.getElementById("copyJsonButton").disabled = true;
  document.getElementById("editRecordButton").disabled = true;
  document.getElementById("jsonViewer").innerText =
    "Select a row to inspect its full JSON content.";

  // Close mobile sidebar if open
  if (window.innerWidth < 1024 && typeof window.toggleSidebar === "function") {
    const sidebar = document.getElementById("sidebar");
    if (sidebar && sidebar.classList.contains("translate-x-0")) {
      window.toggleSidebar();
    }
  }
}
