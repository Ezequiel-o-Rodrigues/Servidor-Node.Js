// ========== APP SHELL ==========
// Lógica compartilhada para todas as páginas autenticadas

function initApp(currentModule) {
  // Verificar se está logado
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) {
    window.location.href = '/login';
    return;
  }

  // Exibir nome do usuário
  const userDisplay = document.getElementById('user-display');
  if (userDisplay) {
    userDisplay.textContent = `${user.displayName || user.username} (${user.role})`;
  }

  // Carregar menu lateral
  loadSidebarMenu(currentModule);
}

async function loadSidebarMenu(currentModule) {
  try {
    const modules = await API.get('/api/auth/modules');
    const menu = document.getElementById('sidebar-menu');
    if (!menu) return;

    // Dashboard sempre visível
    let html = `
      <li>
        <a href="/app" class="${!currentModule || currentModule === 'home' ? 'active' : ''}">
          <span class="menu-icon">&#127968;</span>
          Dashboard
        </a>
      </li>
    `;

    // Links dos módulos
    for (const mod of modules) {
      if (mod.slug === 'auth') continue; // Auth não aparece no menu
      const isActive = currentModule === mod.slug;
      html += `
        <li>
          <a href="/m/${mod.slug}/" class="${isActive ? 'active' : ''}">
            <span class="menu-icon">${getMenuIcon(mod.icon)}</span>
            ${mod.name}
          </a>
        </li>
      `;
    }

    menu.innerHTML = html;
  } catch (err) {
    console.error('Erro ao carregar menu:', err);
  }
}

function getMenuIcon(name) {
  const icons = {
    shield: '&#128737;',
    settings: '&#9881;',
    box: '&#128230;',
    users: '&#128101;',
    chart: '&#128200;',
    mail: '&#9993;',
    cart: '&#128722;',
    chat: '&#128172;',
    file: '&#128196;',
  };
  return icons[name] || icons.box;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

async function doLogout() {
  try {
    await API.post('/api/auth/logout');
  } catch {
    // Ignora erro
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}
