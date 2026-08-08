/**
 * Printa — Admin Router
 * Auth guard + sidebar init for admin zone
 */
(function () {
  // Guard: must be authenticated
  if (!isAuthenticated()) {
    window.location.href = '/login';
    return;
  }

  // Guard: must be admin
  const user = api.getUser();
  if (!user || user.role !== 'ADMIN') {
    window.location.href = '/user/quickprint';
    return;
  }

  initAdminSidebar();
  initAdminHeaderDropdown();
})();

function initAdminHeaderDropdown() {
  const mobileHeader = document.querySelector('.mobile-header');
  const user = api.getUser();

  if (!mobileHeader || !user) return;

  let wrapper = mobileHeader.querySelector('.user-menu-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'user-menu-wrapper';
    wrapper.style.position = 'relative';
    mobileHeader.appendChild(wrapper);
  }

  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'A';

  wrapper.innerHTML = `
    <button type="button" class="user-menu-trigger" id="header-user-trigger">
      <div class="user-avatar-sm" style="background: var(--warning-bg); color: var(--warning);">${initial}</div>
      <div class="user-menu-details">
        <span class="user-menu-name">${escapeHtml(user.name)}</span>
        <span class="user-menu-role">Admin</span>
      </div>
      <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 2px;">▼</span>
    </button>
    <div class="user-menu-dropdown" id="header-user-dropdown">
      <a href="/admin/dashboard" class="dropdown-item">
        <span class="nav-icon" data-icon="barChart"></span> <span>Dashboard</span>
      </a>
      <a href="/admin/orders" class="dropdown-item">
        <span class="nav-icon" data-icon="package"></span> <span>Print Orders</span>
      </a>
      <a href="/admin/documents" class="dropdown-item">
        <span class="nav-icon" data-icon="fileText"></span> <span>Documents</span>
      </a>
      <a href="/admin/users" class="dropdown-item">
        <span class="nav-icon" data-icon="users"></span> <span>Users</span>
      </a>
      <a href="/admin/pricing" class="dropdown-item">
        <span class="nav-icon" data-icon="settings"></span> <span>Pricing Config</span>
      </a>
      <a href="/admin/profile" class="dropdown-item">
        <span class="nav-icon" data-icon="user"></span> <span>Profile</span>
      </a>
      <div class="dropdown-divider"></div>
      <button type="button" class="dropdown-item danger" onclick="logout()">
        <span class="nav-icon" data-icon="logOut"></span> <span>Log Out</span>
      </button>
    </div>
  `;

  wrapper.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.dataset.icon;
    if (icons[name]) el.innerHTML = icons[name];
  });

  const trigger = wrapper.querySelector('#header-user-trigger');
  const dropdown = wrapper.querySelector('#header-user-dropdown');

  if (trigger && dropdown) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
      trigger.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.remove('open');
        trigger.classList.remove('active');
      }
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initAdminSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  const menuToggle = document.querySelector('.menu-toggle');

  if (!sidebar) return;

  // Set SVG icons in sidebar
  document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.dataset.icon;
    if (icons[iconName]) el.innerHTML = icons[iconName];
  });

  // Highlight active nav
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    if (currentPath.includes(item.dataset.page)) item.classList.add('active');
  });

  // User info
  const user = api.getUser();
  if (user) {
    const avatarEl = document.querySelector('.sidebar-user .user-avatar');
    const nameEl = document.querySelector('.sidebar-user .user-name');
    const roleEl = document.querySelector('.sidebar-user .user-role');
    if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = 'Administrator';
  }

  // Mobile toggle
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop?.classList.toggle('open');
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
    });
  }

  // Logout
  const logoutBtn = document.querySelector('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
}
