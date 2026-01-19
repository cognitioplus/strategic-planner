// ==================== CONFIGURATION ====================
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : 'https://your-production-api.com/api';

// ==================== STATE MANAGEMENT ====================
let currentUser = null;
let authToken = null;
let orgData = null;

// ==================== UTILITY FUNCTIONS ====================
function showLoading(show = true) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.toggle('hidden', !show);
  }
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  const notification = document.createElement('div');
  
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600'
  };
  
  notification.className = `notification ${colors[type]} text-white p-4 rounded-xl shadow-2xl`;
  notification.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}" class="w-5 h-5 mr-3"></i>
        <span>${message}</span>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-4 hover:bg-white/20 p-1 rounded">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
  `;
  
  container.appendChild(notification);
  lucide.createIcons();
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function updateIcons() {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function sanitizeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== API FUNCTIONS ====================
async function apiRequest(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  if (authToken) {
    defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ==================== AUTH FUNCTIONS ====================
function showAuthScreen(screen) {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('reset-form').classList.add('hidden');
  document.getElementById('verify-email-screen').classList.add('hidden');
  
  const screens = {
    'login': 'login-form',
    'register': 'register-form',
    'reset': 'reset-form',
    'verify': 'verify-email-screen'
  };
  
  const targetScreen = document.getElementById(screens[screen]);
  if (targetScreen) {
    targetScreen.classList.remove('hidden');
  }
  
  updateIcons();
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');
  
  showLoading();
  
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    authToken = data.token;
    currentUser = data.user;
    
    // Save token securely
    sessionStorage.setItem('authToken', authToken);
    
    if (document.getElementById('remember-me').checked) {
      localStorage.setItem('authToken', authToken);
    }
    
    await initApp();
    
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } finally {
    showLoading(false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  
  const errorEl = document.getElementById('register-error');
  const successEl = document.getElementById('register-success');
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');
  
  // Client-side validation
  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.classList.remove('hidden');
    return;
  }
  
  if (password.length < 8) {
    errorEl.textContent = 'Password must be at least 8 characters';
    errorEl.classList.remove('hidden');
    return;
  }
  
  if (!/[A-Z]/.test(password)) {
    errorEl.textContent = 'Password must contain at least one uppercase letter';
    errorEl.classList.remove('hidden');
    return;
  }
  
  if (!/[0-9]/.test(password)) {
    errorEl.textContent = 'Password must contain at least one number';
    errorEl.classList.remove('hidden');
    return;
  }
  
  showLoading();
  
  try {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    
    document.getElementById('verify-email-address').textContent = email;
    showAuthScreen('verify');
    
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } finally {
    showLoading(false);
  }
}

async function handlePasswordReset(e) {
  e.preventDefault();
  
  const email = document.getElementById('reset-email').value.trim();
  const successEl = document.getElementById('reset-success');
  const errorEl = document.getElementById('reset-error');
  
  successEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  
  showLoading();
  
  try {
    const data = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    
    successEl.textContent = data.message;
    successEl.classList.remove('hidden');
    document.getElementById('reset-email').value = '';
    
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } finally {
    showLoading(false);
  }
}

function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  
  authToken = null;
  currentUser = null;
  orgData = null;
  
  sessionStorage.removeItem('authToken');
  localStorage.removeItem('authToken');
  
  document.getElementById('dashboard-container').classList.add('hidden');
  document.getElementById('auth-container').classList.remove('hidden');
  showAuthScreen('login');
}

async function checkSession() {
  const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
  
  if (token) {
    authToken = token;
    
    try {
      const data = await apiRequest('/auth/me');
      currentUser = data.user;
      await initApp();
      return;
    } catch (error) {
      console.error('Session validation failed:', error);
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('authToken');
    }
  }
  
  document.getElementById('auth-container').classList.remove('hidden');
  showAuthScreen('login');
  updateIcons();
}

// ==================== APP INITIALIZATION ====================
async function initApp() {
  showLoading();
  
  try {
    // Fetch organization data
    orgData = await apiRequest('/organization');
    
    // Update UI
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
    
    const displayName = document.getElementById('user-display-name');
    if (displayName) displayName.textContent = currentUser.name;
    
    const avatar = document.getElementById('user-avatar');
    if (avatar) {
      const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
      avatar.textContent = initials;
    }
    
    navigate('dashboard');
    showNotification('Welcome back, ' + currentUser.name + '!', 'success');
    
  } catch (error) {
    console.error('App initialization failed:', error);
    showNotification('Failed to load data. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// ==================== NAVIGATION ====================
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.remove('hidden');
  
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white');
  });
  
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    const text = btn.textContent.toLowerCase();
    if (text.includes(page) || (page === 'collaboration' && text.includes('team'))) {
      btn.classList.add('bg-slate-800', 'text-white');
    }
  });
  
  // Render page content
  switch(page) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'swot':
      renderSwot();
      break;
    case 'bsc':
      renderBsc();
      break;
    case 'initiatives':
      renderInitiatives();
      break;
    case 'collaboration':
      renderTeam();
      renderChat();
      break;
    case 'plan':
      renderPlan();
      break;
  }
  
  updateIcons();
}

// ==================== DASHBOARD RENDERING ====================
function renderDashboard() {
  if (!orgData) return;
  
  // Update org name and mandate
  const orgNameEl = document.getElementById('org-name-display');
  if (orgNameEl) orgNameEl.textContent = orgData.name;
  
  const mandateEl = document.getElementById('mandate-content');
  if (mandateEl) mandateEl.textContent = `"${orgData.mandate}"`;
  
  // Count strategies by perspective
  const counts = {
    'Financial': 0,
    'Customer': 0,
    'Internal Processes': 0,
    'Learning & Growth': 0
  };
  
  orgData.bsc.forEach(s => {
    if (counts[s.perspective] !== undefined) {
      counts[s.perspective]++;
    }
  });
  
  // Update metric cards
  updateMetricCard('financial', counts['Financial']);
  updateMetricCard('customer', counts['Customer']);
  updateMetricCard('process', counts['Internal Processes']);
  updateMetricCard('lg', counts['Learning & Growth']);
  
  // Render KPI table
  renderDashboardKpis();
  
  // Update last updated time
  const lastUpdated = document.getElementById('last-updated');
  if (lastUpdated) {
    lastUpdated.textContent = new Date().toLocaleString();
  }
}

function updateMetricCard(type, count) {
  const countEl = document.getElementById(`${type}-count`);
  const progressEl = document.getElementById(`${type}-progress`);
  
  if (countEl) countEl.textContent = count;
  if (progressEl) {
    const percentage = Math.min((count / 5) * 100, 100);
    progressEl.style.width = percentage + '%';
  }
}

function renderDashboardKpis() {
  const tbody = document.getElementById('dashboard-kpi-rows');
  if (!tbody || !orgData) return;
  
  if (orgData.bsc.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400">No KPIs defined yet</td></tr>';
    return;
  }
  
  tbody.innerHTML = orgData.bsc.slice(0, 5).map(item => {
    const current = parseFloat(item.current) || 0;
    const target = parseFloat(item.target) || 1;
    const progress = Math.min((current / target) * 100, 100);
    
    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-4 font-medium text-slate-800">${sanitizeHtml(item.objective)}</td>
        <td class="px-6 py-4 text-slate-600">${sanitizeHtml(item.kpi)}</td>
        <td class="px-6 py-4 font-bold text-slate-900">${sanitizeHtml(item.current)} / ${sanitizeHtml(item.target)}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="h-full ${progress >= 100 ? 'bg-green-500' : 'bg-blue-600'}" style="width: ${progress}%"></div>
            </div>
            <span class="text-xs font-bold text-slate-500">${Math.round(progress)}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function editMandate() {
  const name = prompt('Enter Organization Name:', orgData.name);
  const mandate = prompt('Enter Organizational Mandate:', orgData.mandate);
  
  if (!name && !mandate) return;
  
  showLoading();
  
  try {
    const updates = {};
    if (name) updates.name = name;
    if (mandate) updates.mandate = mandate;
    
    orgData = await apiRequest('/organization', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    
    renderDashboard();
    showNotification('Organization details updated', 'success');
    
  } catch (error) {
    showNotification('Failed to update: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ==================== SWOT RENDERING ====================
function renderSwot() {
  if (!orgData) return;
  
  ['S', 'W', 'O', 'T'].forEach(type => {
    const container = document.getElementById(`swot-${type}-list`);
    if (!container) return;
    
    const items = orgData.swot[type] || [];
    
    if (items.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-sm italic">No items yet. Click + to add.</p>';
      return;
    }
    
    container.innerHTML = items.map((item, index) => `
      <div class="flex items-start justify-between bg-white/50 p-3 rounded-lg border border-white/20">
        <span class="text-sm font-medium text-slate-800">${sanitizeHtml(item)}</span>
        <button onclick="removeSwotItem('${type}', ${index})" class="text-slate-400 hover:text-red-500 ml-2">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
  });
  
  updateIcons();
}

async function addSwotItem(type) {
  const labels = {
    'S': 'Strength',
    'W': 'Weakness',
    'O': 'Opportunity',
    'T': 'Threat'
  };
  
  const text = prompt(`Add a new ${labels[type]}:`);
  if (!text || text.trim() === '') return;
  
  showLoading();
  
  try {
    orgData = await apiRequest(`/organization/swot/${type}`, {
      method: 'POST',
      body: JSON.stringify({ text: text.trim() })
    });
    
    renderSwot();
    showNotification(`${labels[type]} added successfully`, 'success');
    
  } catch (error) {
    showNotification('Failed to add item: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function removeSwotItem(type, index) {
  if (!confirm('Remove this item?')) return;
  
  showLoading();
  
  try {
    orgData = await apiRequest(`/organization/swot/${type}/${index}`, {
      method: 'DELETE'
    });
    
    renderSwot();
    showNotification('Item removed', 'success');
    
  } catch (error) {
    showNotification('Failed to remove: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ==================== BSC RENDERING ====================
function renderBsc() {
  if (!orgData) return;
  
  const groups = {
    'Financial': document.getElementById('bsc-financial-list'),
    'Customer': document.getElementById('bsc-customer-list'),
    'Internal Processes': document.getElementById('bsc-process-list'),
    'Learning & Growth': document.getElementById('bsc-lg-list')
  };
  
  Object.entries(groups).forEach(([perspective, container]) => {
    if (!container) return;
    
    const items = orgData.bsc.filter(item => item.perspective === perspective);
    
    if (items.length === 0) {
      container.innerHTML = '<div class="p-6 text-center text-slate-400">No strategies defined</div>';
      return;
    }
    
    container.innerHTML = items.map(item => {
      const current = parseFloat(item.current) || 0;
      const target = parseFloat(item.target) || 1;
      const progress = Math.min((current / target) * 100, 100);
      
      return `
        <div class="p-6 hover:bg-slate-50 transition">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex-grow">
              <h4 class="font-bold text-slate-900">${sanitizeHtml(item.objective)}</h4>
              <div class="flex items-center gap-4 mt-1 text-sm text-slate-500">
                <span class="flex items-center"><i data-lucide="activity" class="w-3 h-3 mr-1"></i> ${sanitizeHtml(item.kpi)}</span>
                <span class="flex items-center"><i data-lucide="target" class="w-3 h-3 mr-1"></i> Target: ${sanitizeHtml(item.target)}</span>
              </div>
            </div>
            <div class="flex items-center gap-6">
              <div class="text-right">
                <div class="text-xs font-bold text-slate-400 uppercase">Current</div>
                <div class="text-lg font-bold text-slate-800">${sanitizeHtml(item.current)}</div>
              </div>
              <div class="w-16 h-16 relative">
                <svg class="w-full h-full" viewBox="0 0 36 36">
                  <path class="text-slate-100" stroke-width="3" stroke="currentColor" fill="none" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path class="${progress >= 100 ? 'text-green-500' : 'text-blue-600'}" stroke-width="3" 
                    stroke-dasharray="${progress}, 100" stroke-linecap="round" stroke="currentColor" fill="none" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold">${Math.round(progress)}%</div>
              </div>
              <div class="flex gap-2">
                <button onclick='editStrategy("${item._id}")' class="p-2 text-slate-400 hover:text-blue-600">
                  <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button onclick='deleteStrategy("${item._id}")' class="p-2 text-slate-400 hover:text-red-600">
                  <i data-lucide="trash" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  });
  
  updateIcons();
}

function openStrategyModal(strategyId = null) {
  const strategy = strategyId 
    ? orgData.bsc.find(s => s._id === strategyId)
    : { objective: '', perspective: 'Financial', kpi: '', target: '', current: '' };
  
  const modal = document.getElementById('modal-content');
  modal.innerHTML = `
    <div class="p-6 border-b flex justify-between items-center">
      <h3 class="text-xl font-bold">${strategyId ? 'Edit' : 'Add'} Strategic Objective</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600">
        <i data-lucide="x"></i>
      </button>
    </div>
    <form id="strategy-form" class="p-6 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Perspective</label>
        <select id="s-perspective" class="w-full border rounded-lg px-3 py-2 outline-none">
          <option ${strategy.perspective === 'Financial' ? 'selected' : ''}>Financial</option>
          <option ${strategy.perspective === 'Customer' ? 'selected' : ''}>Customer</option>
          <option ${strategy.perspective === 'Internal Processes' ? 'selected' : ''}>Internal Processes</option>
          <option ${strategy.perspective === 'Learning & Growth' ? 'selected' : ''}>Learning & Growth</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Strategic Objective</label>
        <input type="text" id="s-obj" value="${sanitizeHtml(strategy.objective)}" required 
          class="w-full border rounded-lg px-3 py-2 outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">KPI Metric</label>
        <input type="text" id="s-kpi" value="${sanitizeHtml(strategy.kpi)}" required 
          class="w-full border rounded-lg px-3 py-2 outline-none">
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Target Value</label>
          <input type="text" id="s-target" value="${sanitizeHtml(strategy.target)}" required 
            class="w-full border rounded-lg px-3 py-2 outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Current Value</label>
          <input type="text" id="s-current" value="${sanitizeHtml(strategy.current)}" required 
            class="w-full border rounded-lg px-3 py-2 outline-none">
        </div>
      </div>
      <div class="pt-4">
        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">
          ${strategyId ? 'Update' : 'Save'} Strategy
        </button>
      </div>
    </form>
  `;
  
  document.getElementById('strategy-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      objective: document.getElementById('s-obj').value,
      perspective: document.getElementById('s-perspective').value,
      kpi: document.getElementById('s-kpi').value,
      target: document.getElementById('s-target').value,
      current: document.getElementById('s-current').value
    };
    
    showLoading();
    
    try {
      if (strategyId) {
        orgData = await apiRequest(`/organization/bsc/${strategyId}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      } else {
        orgData = await apiRequest('/organization/bsc', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
      
      closeModal();
      renderBsc();
      showNotification(`Strategy ${strategyId ? 'updated' : 'added'} successfully`, 'success');
      
    } catch (error) {
      showNotification('Failed to save strategy: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  };
  
  document.getElementById('modal-overlay').classList.remove('hidden');
  updateIcons();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function editStrategy(id) {
  openStrategyModal(id);
}

async function deleteStrategy(id) {
  if (!confirm('Delete this strategy?')) return;
  
  showLoading();
  
  try {
    orgData = await apiRequest(`/organization/bsc/${id}`, {
      method: 'DELETE'
    });
    
    renderBsc();
    showNotification('Strategy deleted', 'success');
    
  } catch (error) {
    showNotification('Failed to delete: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ==================== INITIATIVES ====================
function renderInitiatives() {
  const container = document.getElementById('initiatives-container');
  if (!container || !orgData) return;
  
  if (orgData.initiatives.length === 0) {
    container.innerHTML = '<div class="p-12 text-center text-slate-400 italic">No initiatives yet. Add one to get started.</div>';
    return;
  }
  
  container.innerHTML = orgData.initiatives.map(item => `
    <div class="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center">
      <div class="flex-grow">
        <div class="flex items-center gap-2 mb-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase 
            ${item.status === 'Completed' ? 'bg-green-100 text-green-700' : 
              item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 
              'bg-slate-100 text-slate-600'}">${sanitizeHtml(item.status)}</span>
          <h3 class="font-bold text-slate-900 text-lg">${sanitizeHtml(item.title)}</h3>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-500">
          <div><span class="block font-bold text-slate-400 uppercase">Lead</span> ${sanitizeHtml(item.owner)}</div>
          <div><span class="block font-bold text-slate-400 uppercase">Due Date</span> ${new Date(item.due).toLocaleDateString()}</div>
          <div><span class="block font-bold text-slate-400 uppercase">Resources</span> ${sanitizeHtml(item.resources || 'N/A')}</div>
          <div><span class="block font-bold text-slate-400 uppercase">Output</span> ${sanitizeHtml(item.output)}</div>
        </div>
      </div>
      <button onclick='deleteInitiative("${item._id}")' class="mt-4 md:mt-0 text-red-500 hover:bg-red-50 p-2 rounded">
        <i data-lucide="trash-2" class="w-5 h-5"></i>
      </button>
    </div>
  `).join('');
  
  updateIcons();
}

function openInitiativeModal() {
  const modal = document.getElementById('modal-content');
  const today = new Date().toISOString().split('T')[0]; // For default due date

  modal.innerHTML = `
    <div class="p-6 border-b flex justify-between items-center">
      <h3 class="text-xl font-bold">New Initiative</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600">
        <i data-lucide="x"></i>
      </button>
    </div>
    <form id="init-form" class="p-6 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Project/Activity Title</label>
        <input type="text" id="i-title" required class="w-full border rounded-lg px-3 py-2 outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Owner / Lead</label>
        <input type="text" id="i-owner" required class="w-full border rounded-lg px-3 py-2 outline-none">
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Status</label>
          <select id="i-status" class="w-full border rounded-lg px-3 py-2 outline-none">
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Due Date</label>
          <input type="date" id="i-due" min="${today}" required class="w-full border rounded-lg px-3 py-2 outline-none">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Expected Output / Deliverable</label>
        <input type="text" id="i-output" required class="w-full border rounded-lg px-3 py-2 outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Resources Needed (Optional)</label>
        <input type="text" id="i-resources" class="w-full border rounded-lg px-3 py-2 outline-none">
      </div>
      <div class="pt-4">
        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">
          Save Initiative
        </button>
      </div>
    </form>
  `;

  document.getElementById('init-form').onsubmit = async (e) => {
    e.preventDefault();

    const data = {
      title: document.getElementById('i-title').value.trim(),
      owner: document.getElementById('i-owner').value.trim(),
      status: document.getElementById('i-status').value,
      due: document.getElementById('i-due').value,
      output: document.getElementById('i-output').value.trim(),
      resources: document.getElementById('i-resources').value.trim() || null
    };

    // Basic validation
    if (!data.title || !data.owner || !data.output || !data.due) {
      showNotification('Please fill in all required fields.', 'error');
      return;
    }

    showLoading();

    try {
      orgData = await apiRequest('/organization/initiatives', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      closeModal();
      renderInitiatives();
      showNotification('Initiative added successfully!', 'success');

    } catch (error) {
      showNotification('Failed to save initiative: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  };

  document.getElementById('modal-overlay').classList.remove('hidden');
  updateIcons();
}

    }
    viewContainer.innerHTML = content;
    lucide.createIcons(); // Re-render icons
    mobileOrgName.textContent = orgProfile.name;
  }
});
