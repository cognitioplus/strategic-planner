// Minimal vanilla JS reimplementation of core logic
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  const loadingEl = document.getElementById('loading');
  const appEl = document.getElementById('app');
  const sidebar = document.getElementById('sidebar');
  const openSidebarBtn = document.getElementById('open-sidebar');
  const closeSidebarBtn = document.getElementById('close-sidebar');
  const navButtons = document.querySelectorAll('.nav-btn');
  const viewContainer = document.getElementById('view-container');
  const mobileOrgName = document.getElementById('mobile-org-name');

  let activeTab = 'dashboard';
  let orgProfile = { name: 'Your Organization', country: 'Philippines' };

  // Simulate async load
  setTimeout(() => {
    loadingEl.classList.add('hidden');
    appEl.classList.remove('hidden');
    renderView(activeTab);
  }, 800);

  // Sidebar toggle
  openSidebarBtn?.addEventListener('click', () => sidebar.classList.remove('-translate-x-full'));
  closeSidebarBtn?.addEventListener('click', () => sidebar.classList.add('-translate-x-full'));

  // Navigation
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      renderView(activeTab);
      if (window.innerWidth < 768) sidebar.classList.add('-translate-x-full');
    });
  });

  // Set initial active tab
  document.querySelector(`.nav-btn[data-tab="${activeTab}"]`).classList.add('active');

  // Render views
  function renderView(tab) {
    let content = '';
    switch (tab) {
      case 'dashboard':
        content = `
          <h2 class="text-2xl font-bold text-slate-800 mb-6">Dashboard Overview</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="stat-card">
              <div>
                <p class="stat-title">Budget Requirement</p>
                <h3 class="stat-value">$0</h3>
              </div>
              <div class="stat-icon bg-slate-50 text-emerald-500">
                <i data-lucide="dollar-sign" class="lucide w-6 h-6"></i>
              </div>
            </div>
            <div class="stat-card">
              <div>
                <p class="stat-title">Strategic Initiatives</p>
                <h3 class="stat-value">0</h3>
              </div>
              <div class="stat-icon bg-slate-50 text-blue-500">
                <i data-lucide="clipboard-list" class="lucide w-6 h-6"></i>
              </div>
            </div>
            <div class="stat-card">
              <div>
                <p class="stat-title">SWOT Insights</p>
                <h3 class="stat-value">0</h3>
              </div>
              <div class="stat-icon bg-slate-50 text-purple-500">
                <i data-lucide="target" class="lucide w-6 h-6"></i>
              </div>
            </div>
            <div class="stat-card">
              <div>
                <p class="stat-title">BSC Objectives</p>
                <h3 class="stat-value">0</h3>
              </div>
              <div class="stat-icon bg-slate-50 text-orange-500">
                <i data-lucide="pie-chart" class="lucide w-6 h-6"></i>
              </div>
            </div>
          </div>
        `;
        break;
      case 'paps':
        content = '<div class="text-center p-10">PAPS Manager Component</div>';
        break;
      case 'team':
        content = '<div class="text-center p-10">Team Manager Component</div>';
        break;
      case 'swot':
        content = '<div class="text-center p-10">SWOT Analysis Component</div>';
        break;
      case 'bsc':
        content = '<div class="text-center p-10">Balanced Scorecard Component</div>';
        break;
      case 'profile':
        content = '<div class="text-center p-10">Organization Profile Component</div>';
        break;
      case 'report':
        content = '<div class="text-center p-10">Strategic Plan Report Component</div>';
        break;
      default:
        content = '<div>Unknown tab</div>';
    }
    viewContainer.innerHTML = content;
    lucide.createIcons(); // Re-render icons
    mobileOrgName.textContent = orgProfile.name;
  }
});
