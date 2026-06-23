/**
 * Toast Component for Realm Live Debugger
 */

export function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transform translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto max-w-sm ${
    type === 'success' 
      ? 'bg-emerald-950/90 border-emerald-800 text-emerald-100' 
      : type === 'error'
      ? 'bg-rose-950/90 border-rose-800 text-rose-100'
      : 'bg-indigo-950/90 border-indigo-850 text-indigo-100'
  }`;

  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
  const iconColor = type === 'success' ? 'text-emerald-400' : type === 'error' ? 'text-rose-400' : 'text-indigo-300';

  toast.innerHTML = `
    <i data-feather="${icon}" class="w-5 h-5 ${iconColor} shrink-0 mt-0.5"></i>
    <div class="flex-grow">
      <h4 class="text-xs font-bold text-white">${title}</h4>
      <p class="text-[11px] text-white/80 mt-0.5 leading-relaxed">${message}</p>
    </div>
    <button class="text-white/60 hover:text-white transition focus:outline-none shrink-0" onclick="this.parentElement.remove()">
      <i data-feather="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.feather) {
    window.feather.replace();
  }

  // Trigger animation
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  // Auto-remove after 4.5 seconds
  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4500);
}

// Bind to window to allow trigger from global context if needed
window.showToast = showToast;
