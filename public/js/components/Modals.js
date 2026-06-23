/**
 * Modals Component - Handles Add Record, Edit Record, and Add Column Modal dialogs
 */
import { store } from '../store.js';
import { showToast } from './Toast.js';

export function initModals() {
  // Bind buttons
  const addRecordBtn = document.getElementById('addRecordButton');
  if (addRecordBtn) {
    addRecordBtn.onclick = openAddRecordModal;
  }

  const addColBtn = document.getElementById('addColumnButton');
  if (addColBtn) {
    addColBtn.onclick = openAddColumnModal;
  }

  const editRecordBtn = document.getElementById('editRecordButton');
  if (editRecordBtn) {
    editRecordBtn.onclick = openEditRecordModal;
  }

  // Set global references so legacy inline handlers continue working if any
  window.openAddRecordModal = openAddRecordModal;
  window.closeAddRecordModal = closeAddRecordModal;
  window.submitAddRecord = submitAddRecord;

  window.openEditRecordModal = openEditRecordModal;
  window.closeEditRecordModal = closeEditRecordModal;
  window.submitEditRecord = submitEditRecord;

  window.openAddColumnModal = openAddColumnModal;
  window.closeAddColumnModal = closeAddColumnModal;
  window.submitAddColumn = submitAddColumn;

  window.showModalError = showModalError;
}

function getActiveSchema() {
  const { selectedFile, selectedSchema, currentCache } = store.state;
  if (!selectedFile || !selectedSchema) return null;
  const file = currentCache[selectedFile];
  if (!file || !file.schemas) return null;
  return file.schemas.find(s => s.name === selectedSchema);
}

// -------------------------------------------------------------
// ADD RECORD MODAL
// -------------------------------------------------------------
export function openAddRecordModal() {
  const { selectedSchema } = store.state;
  if (!selectedSchema) return;
  const schema = getActiveSchema();
  if (!schema) return;

  hideModalError();
  resetAddRecordModalState();

  const formContainer = document.getElementById('addRecordFormFields');
  if (!formContainer) return;
  formContainer.innerHTML = '';

  const properties = schema.properties;
  for (const key of Object.keys(properties)) {
    let propDef = properties[key];
    let propType = typeof propDef === 'string' ? propDef : (propDef.type || 'string');
    let isOptional = typeof propDef === 'object' ? !!propDef.optional : false;

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'flex flex-col gap-1.5';

    const label = document.createElement('label');
    label.className = 'text-xs font-semibold text-slate-300 flex items-center justify-between';
    label.innerHTML = `
      <span>${key}</span>
      <span class="text-[10px] text-slate-500 font-mono font-normal">
        ${propType}${isOptional ? ' (optional)' : ''}
      </span>
    `;
    fieldGroup.appendChild(label);

    let inputElement;
    
    if (key === '_id') {
      inputElement = document.createElement('input');
      inputElement.type = 'text';
      inputElement.placeholder = '[Auto-Generated BSON ObjectId]';
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-500 placeholder-slate-650 focus:outline-none';
      inputElement.readOnly = true;
      inputElement.disabled = true;
      inputElement.value = 'Auto-Generated BSON ObjectId';
    } else if (propType === 'bool' || propType === 'boolean') {
      inputElement = document.createElement('select');
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition';
      inputElement.innerHTML = `
        <option value="true">true</option>
        <option value="false">false</option>
      `;
    } else if (propType === 'int' || propType === 'double' || propType === 'float') {
      inputElement = document.createElement('input');
      inputElement.type = 'number';
      inputElement.step = propType === 'int' ? '1' : 'any';
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition';
      inputElement.placeholder = `Enter number...`;
    } else if (propType === 'date') {
      inputElement = document.createElement('input');
      inputElement.type = 'datetime-local';
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition';
    } else {
      inputElement = document.createElement('input');
      inputElement.type = 'text';
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition';
      inputElement.placeholder = `Enter ${key}...`;
    }

    inputElement.id = `modal-field-${key}`;
    fieldGroup.appendChild(inputElement);
    formContainer.appendChild(fieldGroup);
  }

  document.getElementById('addRecordModal').classList.remove('hidden');
  if (window.feather) window.feather.replace();
}

export function closeAddRecordModal() {
  document.getElementById('addRecordModal').classList.add('hidden');
}

export function submitAddRecord() {
  const { selectedSchema } = store.state;
  if (!selectedSchema) return;
  const schema = getActiveSchema();
  if (!schema) return;

  const record = {};
  const properties = schema.properties;

  for (const key of Object.keys(properties)) {
    if (key === '_id') continue;
    
    const input = document.getElementById(`modal-field-${key}`);
    if (input) {
      if (input.tagName === 'SELECT') {
        record[key] = input.value === 'true';
      } else {
        record[key] = input.value;
      }
    }
  }

  hideModalError();
  const saveBtn = document.getElementById('saveRecordBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...`;
  }
  const cancelBtn = document.getElementById('cancelRecordBtn');
  if (cancelBtn) {
    cancelBtn.disabled = true;
  }

  store.sendAddRecord(selectedSchema, record);
}

function resetAddRecordModalState() {
  const btn = document.getElementById('saveRecordBtn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = 'Save Record';
  }
  const cancelBtn = document.getElementById('cancelRecordBtn');
  if (cancelBtn) {
    cancelBtn.disabled = false;
  }
}

function showModalError(message) {
  const alertEl = document.getElementById('modalErrorAlert');
  const textEl = document.getElementById('modalErrorText');
  if (alertEl && textEl) {
    textEl.innerText = message;
    alertEl.classList.remove('hidden');
  }
  resetAddRecordModalState();
}

function hideModalError() {
  const alertEl = document.getElementById('modalErrorAlert');
  if (alertEl) {
    alertEl.classList.add('hidden');
  }
}

// -------------------------------------------------------------
// EDIT RECORD MODAL
// -------------------------------------------------------------
export function openEditRecordModal() {
  const { selectedSchema, activeRecord } = store.state;
  if (!selectedSchema || !activeRecord) return;
  const schema = getActiveSchema();
  if (!schema) return;

  hideEditModalError();
  resetEditRecordModalState();

  const formContainer = document.getElementById('editRecordFormFields');
  if (!formContainer) return;
  formContainer.innerHTML = '';

  const properties = schema.properties;
  for (const key of Object.keys(properties)) {
    let propDef = properties[key];
    let propType = typeof propDef === 'string' ? propDef : (propDef.type || 'string');
    let isOptional = typeof propDef === 'object' ? !!propDef.optional : false;
    let isPrimaryKey = schema.primaryKey === key;
    
    let currentVal = activeRecord[key];

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'flex flex-col gap-1.5';

    const label = document.createElement('label');
    label.className = 'text-xs font-semibold text-slate-300 flex items-center justify-between';
    label.innerHTML = `
      <span>${key}</span>
      <span class="text-[10px] text-slate-500 font-mono font-normal">
        ${propType}${isOptional ? ' (optional)' : ''}${isPrimaryKey ? ' [Primary Key]' : ''}
      </span>
    `;
    fieldGroup.appendChild(label);

    let inputElement;
    
    if (isPrimaryKey) {
      inputElement = document.createElement('input');
      inputElement.type = 'text';
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-500 placeholder-slate-650 focus:outline-none';
      inputElement.readOnly = true;
      inputElement.disabled = true;
      inputElement.value = currentVal || '';
    } else if (propType === 'bool' || propType === 'boolean') {
      inputElement = document.createElement('select');
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition';
      inputElement.innerHTML = `
        <option value="true" ${currentVal === true ? 'selected' : ''}>true</option>
        <option value="false" ${currentVal === false ? 'selected' : ''}>false</option>
      `;
    } else if (propType === 'int' || propType === 'double' || propType === 'float') {
      inputElement = document.createElement('input');
      inputElement.type = 'number';
      inputElement.step = propType === 'int' ? '1' : 'any';
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition';
      inputElement.placeholder = `Enter number...`;
      inputElement.value = currentVal !== undefined && currentVal !== null ? currentVal : '';
    } else if (propType === 'date') {
      inputElement = document.createElement('input');
      inputElement.type = 'datetime-local';
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition';
      
      if (currentVal) {
        try {
          const dateObj = new Date(currentVal);
          if (!isNaN(dateObj.getTime())) {
            const tzoffset = dateObj.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(dateObj - tzoffset)).toISOString().slice(0, 16);
            inputElement.value = localISOTime;
          }
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      inputElement = document.createElement('input');
      inputElement.type = 'text';
      inputElement.className = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition';
      inputElement.placeholder = `Enter ${key}...`;
      if (currentVal !== undefined && currentVal !== null) {
        if (typeof currentVal === 'object') {
          inputElement.value = Array.isArray(currentVal) ? currentVal.join(', ') : JSON.stringify(currentVal);
        } else {
          inputElement.value = currentVal;
        }
      }
    }

    inputElement.id = `edit-modal-field-${key}`;
    fieldGroup.appendChild(inputElement);
    formContainer.appendChild(fieldGroup);
  }

  document.getElementById('editRecordModal').classList.remove('hidden');
  if (window.feather) window.feather.replace();
}

export function closeEditRecordModal() {
  document.getElementById('editRecordModal').classList.add('hidden');
}

export function submitEditRecord() {
  const { selectedSchema, activeRecord } = store.state;
  if (!selectedSchema || !activeRecord) return;
  const schema = getActiveSchema();
  if (!schema) return;

  const record = {};
  const properties = schema.properties;
  const primaryKeyVal = activeRecord[schema.primaryKey];

  for (const key of Object.keys(properties)) {
    if (key === schema.primaryKey) continue;
    
    const input = document.getElementById(`edit-modal-field-${key}`);
    if (input) {
      if (input.tagName === 'SELECT') {
        record[key] = input.value === 'true';
      } else {
        record[key] = input.value;
      }
    }
  }

  hideEditModalError();
  const saveBtn = document.getElementById('saveEditRecordBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...`;
  }
  const cancelBtn = document.getElementById('cancelEditRecordBtn');
  if (cancelBtn) {
    cancelBtn.disabled = true;
  }

  store.sendUpdateRecord(selectedSchema, primaryKeyVal, record);
}

function resetEditRecordModalState() {
  const btn = document.getElementById('saveEditRecordBtn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = 'Save Changes';
  }
  const cancelBtn = document.getElementById('cancelEditRecordBtn');
  if (cancelBtn) {
    cancelBtn.disabled = false;
  }
}

function showEditModalError(message) {
  const alertEl = document.getElementById('editModalErrorAlert');
  const textEl = document.getElementById('editModalErrorText');
  if (alertEl && textEl) {
    textEl.innerText = message;
    alertEl.classList.remove('hidden');
  }
  resetEditRecordModalState();
}

function hideEditModalError() {
  const alertEl = document.getElementById('editModalErrorAlert');
  if (alertEl) {
    alertEl.classList.add('hidden');
  }
}

// -------------------------------------------------------------
// ADD COLUMN MODAL
// -------------------------------------------------------------
export function openAddColumnModal() {
  const { selectedSchema } = store.state;
  if (!selectedSchema) return;

  hideColumnModalError();
  resetAddColumnModalState();

  const targetSchemaInput = document.getElementById('addColumnTargetSchema');
  if (targetSchemaInput) {
    targetSchemaInput.value = selectedSchema;
  }

  // Clear name input
  const nameInput = document.getElementById('addColumnName');
  if (nameInput) nameInput.value = '';

  const optionalCheckbox = document.getElementById('addColumnOptional');
  if (optionalCheckbox) optionalCheckbox.checked = false;

  document.getElementById('addColumnModal').classList.remove('hidden');
  if (window.feather) window.feather.replace();
}

export function closeAddColumnModal() {
  document.getElementById('addColumnModal').classList.add('hidden');
}

export function submitAddColumn() {
  const { selectedSchema } = store.state;
  if (!selectedSchema) return;

  const colName = document.getElementById('addColumnName').value.trim();
  const colType = document.getElementById('addColumnType').value;
  const isOptional = document.getElementById('addColumnOptional').checked;

  if (!colName) {
    showColumnModalError('Column Name is required.');
    return;
  }

  hideColumnModalError();
  const saveBtn = document.getElementById('saveAddColumnBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Adding...`;
  }
  const cancelBtn = document.getElementById('cancelAddColumnBtn');
  if (cancelBtn) {
    cancelBtn.disabled = true;
  }

  store.sendAddSchemaColumn(selectedSchema, colName, colType, isOptional);
}

function resetAddColumnModalState() {
  const btn = document.getElementById('saveAddColumnBtn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = 'Add Column';
  }
  const cancelBtn = document.getElementById('cancelAddColumnBtn');
  if (cancelBtn) {
    cancelBtn.disabled = false;
  }
}

function showColumnModalError(message) {
  const alertEl = document.getElementById('columnModalErrorAlert');
  const textEl = document.getElementById('columnModalErrorText');
  if (alertEl && textEl) {
    textEl.innerText = message;
    alertEl.classList.remove('hidden');
  }
  resetAddColumnModalState();
}

function hideColumnModalError() {
  const alertEl = document.getElementById('columnModalErrorAlert');
  if (alertEl) {
    alertEl.classList.add('hidden');
  }
}
