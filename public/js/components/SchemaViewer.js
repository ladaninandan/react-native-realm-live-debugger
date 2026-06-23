/**
 * SchemaViewer Component - Renders raw schema definition in the schema viewer tab
 */
import { store } from '../store.js';

export function initSchemaViewer() {
  store.subscribeSelector(
    (state) => {
      const file = state.selectedFile ? state.currentCache[state.selectedFile] : null;
      const activeSchema = (file && state.selectedSchema) ? file.schemas.find(s => s.name === state.selectedSchema) : null;
      return {
        selectedFile: state.selectedFile,
        selectedSchema: state.selectedSchema,
        schema: activeSchema
      };
    },
    () => {
      renderSchemaView(store.state);
    }
  );
}

function renderSchemaView(state) {
  const viewer = document.getElementById('schemaJsonViewer');
  if (!viewer) return;

  const { selectedFile, selectedSchema, currentCache } = state;
  const file = currentCache[selectedFile];

  if (!selectedFile || !file) {
    viewer.innerText = 'Select a schema from the sidebar to view its raw database JSON.';
    const copySchemaJsonButton = document.getElementById('copySchemaJsonButton');
    if (copySchemaJsonButton) copySchemaJsonButton.disabled = true;
    return;
  }

  if (!selectedSchema) {
    viewer.innerText = 'Select a schema from the sidebar to view its raw database JSON.';
    const copySchemaJsonButton = document.getElementById('copySchemaJsonButton');
    if (copySchemaJsonButton) copySchemaJsonButton.disabled = true;
    return;
  }

  const schemas = file.schemas || [];
  const activeSchema = schemas.find(s => s.name === selectedSchema);

  if (activeSchema) {
    viewer.innerText = JSON.stringify(activeSchema, null, 2);
    const copySchemaJsonButton = document.getElementById('copySchemaJsonButton');
    if (copySchemaJsonButton) copySchemaJsonButton.disabled = false;
  } else {
    viewer.innerText = 'Select a schema from the sidebar to view its raw database JSON.';
    const copySchemaJsonButton = document.getElementById('copySchemaJsonButton');
    if (copySchemaJsonButton) copySchemaJsonButton.disabled = true;
  }
}
