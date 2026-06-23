/**
 * Main Application Bootstrapper for Realm Live Debugger
 */
import { store } from './store.js';
import { router } from './router.js';
import { initSidebar } from './components/Sidebar.js';
import { initDatabaseTable } from './components/DatabaseTable.js';
import { initJsonInspector } from './components/JsonInspector.js';
import { initChangeLogs } from './components/ChangeLogs.js';
import { initSchemaViewer } from './components/SchemaViewer.js';
import { initModals } from './components/Modals.js';
import { showToast } from './components/Toast.js';

// Bind to window to allow legacy inline HTML handlers to transition smoothly
window.switchTab = (tabId) => router.switchTab(tabId);
window.requestFullRefresh = () => store.requestFullRefresh();

// Initialize all UI modules when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Dashboard] Initializing modular UI...');
  
  // Initialize UI components
  initSidebar();
  initDatabaseTable();
  initJsonInspector();
  initChangeLogs();
  initSchemaViewer();
  initModals();

  // Handle header Sync button click
  const refreshBtn = document.getElementById('refreshButton');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      store.requestFullRefresh();
      
      // Dynamic button load feedback
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i data-feather="loader" class="w-4 h-4 animate-spin"></i> Syncing...';
      if (window.feather) window.feather.replace();
      
      setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i data-feather="refresh-cw" class="w-4 h-4"></i> Sync App';
        if (window.feather) window.feather.replace();
      }, 1200);
    });
  }

  // Handle tab router selection changes
  router.subscribe((currentTab) => {
    console.log(`[Dashboard] Tab switched to: ${currentTab}`);
  });

  // Subscribe to general header status updates selectively
  store.subscribeSelector(
    (state) => ({
      status: state.status,
      topRecordCount: state.topRecordCount,
      lastUpdatedTime: state.lastUpdatedTime
    }),
    () => {
      updateHeaderStatus(store.state);
    }
  );

  // Start Websocket connection
  store.connectInspector();

  // Initialize icon rendering
  if (window.feather) {
    window.feather.replace();
  }
});

// Update the top header bar and status indicators
function updateHeaderStatus(state) {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const topRecordCount = document.getElementById('topRecordCount');
  const lastUpdatedTime = document.getElementById('lastUpdatedTime');

  if (statusIndicator && statusText) {
    statusIndicator.className = 'w-3.5 h-3.5 rounded-full animate-pulse ';
    
    if (state.status === 'online') {
      statusIndicator.classList.add('bg-green-500', 'glowing-green');
      statusText.innerText = 'Connected to Inspector';
      statusText.className = 'text-sm font-medium text-green-400';
    } else if (state.status === 'connecting') {
      statusIndicator.classList.add('bg-yellow-500', 'glowing-yellow');
      statusText.innerText = 'Connecting to Inspector...';
      statusText.className = 'text-sm font-medium text-yellow-500';
    } else {
      statusIndicator.classList.add('bg-red-500', 'glowing-red');
      statusText.innerText = 'Connection Lost. Re-connecting...';
      statusText.className = 'text-sm font-medium text-rose-500';
    }
  }

  const statusIndicatorMobile = document.getElementById('statusIndicatorMobile');
  if (statusIndicatorMobile) {
    statusIndicatorMobile.className = 'w-2.5 h-2.5 rounded-full animate-pulse ';
    if (state.status === 'online') {
      statusIndicatorMobile.classList.add('bg-green-500', 'glowing-green');
    } else if (state.status === 'connecting') {
      statusIndicatorMobile.classList.add('bg-yellow-500', 'glowing-yellow');
    } else {
      statusIndicatorMobile.classList.add('bg-red-500', 'glowing-red');
    }
  }

  if (topRecordCount) {
    topRecordCount.innerText = state.topRecordCount;
  }
  
  if (lastUpdatedTime) {
    lastUpdatedTime.innerText = state.lastUpdatedTime;
  }
}
