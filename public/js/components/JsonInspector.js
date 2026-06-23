/**
 * JsonInspector Component - Handles active row details JSON viewer, copying, and sidebar resizing
 */
import { store } from '../store.js';
import { showToast } from './Toast.js';

export function initJsonInspector() {
  const copyBtn = document.getElementById('copyJsonButton');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyActiveRecordJson);
  }

  const copySchemaBtn = document.getElementById('copySchemaJsonButton');
  if (copySchemaBtn) {
    copySchemaBtn.addEventListener('click', copySchemaJson);
  }

  initSidebarResizer();

  // Listen to state changes to enable/disable Copy button selectively
  store.subscribeSelector(
    (state) => state.activeRecord ? String(state.activeRecord._id) : null,
    () => {
      const { activeRecord } = store.state;
      if (copyBtn) {
        copyBtn.disabled = !activeRecord;
      }
    }
  );
}

function copyActiveRecordJson() {
  const { activeRecord } = store.state;
  if (!activeRecord) return;

  navigator.clipboard.writeText(JSON.stringify(activeRecord, null, 2))
    .then(() => {
      const btn = document.getElementById('copyJsonButton');
      if (btn) {
        btn.innerHTML = '<i data-feather="check" class="w-3 h-3 text-green-400"></i> Copied!';
        if (window.feather) window.feather.replace();
        
        setTimeout(() => {
          btn.innerHTML = '<i data-feather="copy" class="w-3 h-3"></i> Copy';
          if (window.feather) window.feather.replace();
        }, 1500);
      }
      showToast('Clipboard', 'Row JSON copied to clipboard.', 'success');
    })
    .catch(err => {
      console.error('[Clipboard] Failed to copy text: ', err);
      showToast('Clipboard Error', 'Failed to copy JSON.', 'error');
    });
}

function copySchemaJson() {
  const { selectedFile, selectedSchema, currentCache } = store.state;
  if (!selectedFile || !selectedSchema) return;
  const file = currentCache[selectedFile];
  if (!file) return;

  const records = file.data[selectedSchema] || [];
  navigator.clipboard.writeText(JSON.stringify(records, null, 2))
    .then(() => {
      const btn = document.getElementById('copySchemaJsonButton');
      if (btn) {
        btn.innerHTML = '<i data-feather="check" class="w-3.5 h-3.5 text-green-400"></i> Copied!';
        if (window.feather) window.feather.replace();
        
        setTimeout(() => {
          btn.innerHTML = '<i data-feather="copy" class="w-3.5 h-3.5"></i> Copy JSON';
          if (window.feather) window.feather.replace();
        }, 1500);
      }
      showToast('Clipboard', 'Schema data JSON copied to clipboard.', 'success');
    })
    .catch(err => {
      console.error('[Clipboard] Failed to copy text: ', err);
      showToast('Clipboard Error', 'Failed to copy Schema JSON.', 'error');
    });
}

function initSidebarResizer() {
  const resizer = document.getElementById('jsonInspectorResizer');
  const sidebar = document.getElementById('jsonInspectorSidebar');
  if (!resizer || !sidebar) return;
  
  const container = resizer.parentElement;
  let startX, startWidth;
  
  resizer.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    
    document.body.classList.add('cursor-col-resize', 'select-none');
    
    function onMouseMove(moveEvent) {
      const deltaX = startX - moveEvent.clientX; // Dragging left makes the right sidebar larger
      const newWidth = startWidth + deltaX;
      
      const containerWidth = container.offsetWidth;
      const minWidth = 250;
      const maxWidth = containerWidth * 0.75;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        sidebar.style.width = `${newWidth}px`;
      }
    }
    
    function onMouseUp() {
      document.body.classList.remove('cursor-col-resize', 'select-none');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}
