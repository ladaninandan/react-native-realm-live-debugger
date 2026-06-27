/**
 * DatabaseTable Component - Renders records table
 */
import { store } from "../store.js";

export function initDatabaseTable() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      store.setState({ tableSearchQuery: e.target.value });
    });
  }

  // Subscribe to updates to render table content selectively
  store.subscribeSelector(
    (state) => {
      const fileCache = state.selectedFile
        ? state.currentCache[state.selectedFile]
        : null;
      const schemaData =
        fileCache && state.selectedSchema
          ? fileCache.data[state.selectedSchema]
          : null;
      const schemaInfo =
        fileCache && state.selectedSchema
          ? fileCache.schemas.find((s) => s.name === state.selectedSchema)
          : null;
      return {
        selectedFile: state.selectedFile,
        selectedSchema: state.selectedSchema,
        records: schemaData,
        schema: schemaInfo,
        tableSearchQuery: state.tableSearchQuery,
        activeRecordId: state.activeRecord
          ? String(state.activeRecord._id)
          : null,
      };
    },
    () => {
      renderRecordsTable(store.state);
    },
  );
}

function renderRecordsTable(state) {
  const headersRow = document.getElementById("tableHeaders");
  const bodyContainer = document.getElementById("tableBody");
  if (!headersRow || !bodyContainer) return;

  headersRow.innerHTML = "";
  bodyContainer.innerHTML = "";

  const {
    selectedFile,
    selectedSchema,
    currentCache,
    tableSearchQuery,
    activeRecord,
  } = state;

  if (!selectedFile || !selectedSchema) {
    headersRow.innerHTML = '<th class="p-4">No Table Selected</th>';
    bodyContainer.innerHTML = `
      <tr>
        <td class="p-8 text-center text-slate-500 italic">
          Select a schema from the sidebar to inspect records
        </td>
      </tr>`;
    return;
  }

  const file = currentCache[selectedFile];
  if (!file) return;

  const schemas = file.schemas || [];
  const schema = schemas.find((s) => s.name === selectedSchema);
  if (!schema) return;

  const records = file.data[selectedSchema] || [];
  const query = tableSearchQuery.toLowerCase().trim();

  // Filter records
  const filtered = records.filter((record) => {
    if (!query) return true;
    return Object.values(record).some(
      (val) =>
        val !== null &&
        val !== undefined &&
        String(val).toLowerCase().includes(query),
    );
  });

  // Update counters
  const topRecordCount = document.getElementById("topRecordCount");
  if (topRecordCount) topRecordCount.innerText = filtered.length;

  const lastUpdatedTime = document.getElementById("lastUpdatedTime");
  if (lastUpdatedTime) lastUpdatedTime.innerText = file.lastUpdated || "-";

  // Gather header columns
  const properties = Object.keys(schema.properties);

  if (properties.length === 0) {
    headersRow.innerHTML =
      '<th class="p-4 text-slate-500 italic">No Schema Properties Defined</th>';
    bodyContainer.innerHTML =
      '<tr><td class="p-8 text-center text-slate-500">Schema has no properties.</td></tr>';
    return;
  }

  // Render headers
  const headerHtml = ['<th class="p-4 w-12 text-slate-500 text-center">#</th>'];
  properties.forEach((prop) => {
    headerHtml.push(`<th class="p-4 font-semibold">${prop}</th>`);
  });
  headersRow.innerHTML = headerHtml.join("");

  // Render rows
  if (filtered.length === 0) {
    bodyContainer.innerHTML = `
      <tr>
        <td colspan="${properties.length + 1}" class="p-8 text-center text-slate-500 italic">
          ${records.length === 0 ? "No database records found" : "No records match search filter"}
        </td>
      </tr>`;
    return;
  }

  filtered.forEach((record, index) => {
    const row = document.createElement("tr");
    const isActive =
      activeRecord && String(activeRecord._id) === String(record._id);

    row.className = `hover:bg-slate-900/60 border-b border-slate-800/40 transition cursor-pointer select-none ${
      isActive ? "bg-indigo-600/10 hover:bg-indigo-600/15" : ""
    }`;

    row.onclick = () => selectRecordRow(record, row);

    const rowCells = [
      `<td class="p-4 text-center font-mono text-[11px] text-slate-500">${index + 1}</td>`,
    ];

    properties.forEach((prop) => {
      let val = record[prop];
      if (val === null || val === undefined) {
        rowCells.push('<td class="p-4 text-slate-600 italic">null</td>');
      } else if (typeof val === "object") {
        rowCells.push(
          `<td class="p-4 text-indigo-400 font-mono text-xs max-w-[200px] truncate">${JSON.stringify(val)}</td>`,
        );
      } else {
        rowCells.push(
          `<td class="p-4 truncate max-w-[250px] font-sans">${String(val)}</td>`,
        );
      }
    });

    row.innerHTML = rowCells.join("");
    bodyContainer.appendChild(row);
  });
}

function selectRecordRow(record, rowElement) {
  // Update state store
  store.setState({ activeRecord: record });

  const tbody = document.getElementById("tableBody");
  if (tbody) {
    Array.from(tbody.children).forEach((child) => {
      child.classList.remove("bg-indigo-600/10", "hover:bg-indigo-600/15");
    });
  }
  rowElement.classList.add("bg-indigo-600/10", "hover:bg-indigo-600/15");

  // Update JSON viewer content
  const viewer = document.getElementById("jsonViewer");
  if (viewer) {
    viewer.innerText = JSON.stringify(record, null, 2);
  }

  // Enable buttons
  const copyBtn = document.getElementById("copyJsonButton");
  const editBtn = document.getElementById("editRecordButton");
  if (copyBtn) copyBtn.disabled = false;
  if (editBtn) editBtn.disabled = false;
}
