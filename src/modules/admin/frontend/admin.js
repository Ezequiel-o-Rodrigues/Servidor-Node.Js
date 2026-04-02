// ========== ADMIN DASHBOARD ==========
(function () {
  initApp('admin');

  // ========== ELEMENTS ==========
  var modalOverlay = document.getElementById('modal-overlay');
  var btnNewUser = document.getElementById('btn-new-user');
  var btnModalClose = document.getElementById('btn-modal-close');
  var btnModalCancel = document.getElementById('btn-modal-cancel');
  var btnLogout = document.getElementById('btn-logout');
  var btnSidebar = document.getElementById('btn-sidebar');
  var userForm = document.getElementById('user-form');

  // ========== MODAL ==========
  function closeModal() {
    modalOverlay.hidden = true;
  }

  function showCreateUserModal() {
    document.getElementById('modal-title').textContent = 'Novo Usuário';
    userForm.reset();
    document.getElementById('edit-user-id').value = '';
    document.getElementById('form-password').required = true;
    document.getElementById('form-username').disabled = false;
    modalOverlay.hidden = false;
  }

  btnNewUser.addEventListener('click', showCreateUserModal);
  btnModalClose.addEventListener('click', closeModal);
  btnModalCancel.addEventListener('click', closeModal);
  btnLogout.addEventListener('click', doLogout);
  btnSidebar.addEventListener('click', toggleSidebar);

  // ========== STATS ==========
  async function loadStats() {
    try {
      var stats = await API.get('/api/admin/stats');
      document.getElementById('stat-users').textContent = stats.users.total;
      document.getElementById('stat-modules').textContent = stats.modules.enabled;
      document.getElementById('stat-sessions').textContent = stats.activeSessions;
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  }

  // ========== USERS ==========
  async function loadUsers() {
    try {
      var users = await API.get('/api/admin/users');
      var tbody = document.getElementById('users-tbody');
      tbody.innerHTML = '';

      users.forEach(function (u) {
        var tr = document.createElement('tr');

        var roleBadge = u.role === 'super_admin' ? 'danger' : u.role === 'admin' ? 'warning' : 'default';
        var activeBadge = u.active ? 'success' : 'default';
        var lastLogin = u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'Nunca';

        tr.innerHTML =
          '<td>' + u.id + '</td>' +
          '<td><strong>' + u.username + '</strong></td>' +
          '<td>' + (u.display_name || '-') + '</td>' +
          '<td><span class="badge badge-' + roleBadge + '">' + u.role + '</span></td>' +
          '<td><span class="badge badge-' + activeBadge + '">' + (u.active ? 'Sim' : 'Não') + '</span></td>' +
          '<td>' + lastLogin + '</td>' +
          '<td>' +
          '<button class="btn btn-ghost btn-xs btn-edit" data-id="' + u.id + '">Editar</button> ' +
          '<button class="btn btn-ghost btn-xs text-danger btn-delete" data-id="' + u.id + '" data-name="' + u.username + '">Excluir</button>' +
          '</td>';

        tbody.appendChild(tr);
      });

      // Bind edit/delete buttons
      tbody.querySelectorAll('.btn-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          editUser(parseInt(this.getAttribute('data-id')));
        });
      });

      tbody.querySelectorAll('.btn-delete').forEach(function (btn) {
        btn.addEventListener('click', function () {
          confirmDeleteUser(parseInt(this.getAttribute('data-id')), this.getAttribute('data-name'));
        });
      });

    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  }

  async function editUser(id) {
    try {
      var user = await API.get('/api/admin/users/' + id);
      document.getElementById('modal-title').textContent = 'Editar Usuário';
      document.getElementById('edit-user-id').value = id;
      document.getElementById('form-username').value = user.username;
      document.getElementById('form-username').disabled = true;
      document.getElementById('form-email').value = user.email || '';
      document.getElementById('form-displayname').value = user.display_name || '';
      document.getElementById('form-role').value = user.role;
      document.getElementById('form-password').value = '';
      document.getElementById('form-password').required = false;
      modalOverlay.hidden = false;
    } catch (err) {
      alert('Erro ao carregar usuário: ' + err.message);
    }
  }

  async function confirmDeleteUser(id, username) {
    if (!confirm('Tem certeza que deseja excluir o usuário "' + username + '"?')) return;
    try {
      await API.delete('/api/admin/users/' + id);
      await loadUsers();
      await loadStats();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  }

  // ========== FORM SUBMIT ==========
  userForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = document.getElementById('edit-user-id').value;
    var data = {
      email: document.getElementById('form-email').value || undefined,
      displayName: document.getElementById('form-displayname').value || undefined,
      role: document.getElementById('form-role').value,
    };

    var password = document.getElementById('form-password').value;
    if (password) data.password = password;

    try {
      if (id) {
        await API.put('/api/admin/users/' + id, data);
      } else {
        data.username = document.getElementById('form-username').value;
        await API.post('/api/admin/users', data);
      }
      closeModal();
      await loadUsers();
      await loadStats();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });

  // ========== MODULES ==========
  function getIcon(name) {
    var icons = {
      shield: '&#128737;',
      settings: '&#9881;',
      box: '&#128230;',
      users: '&#128101;',
    };
    return icons[name] || icons.box;
  }

  async function loadModules() {
    try {
      var modules = await API.get('/api/admin/modules');
      var grid = document.getElementById('modules-grid');
      grid.innerHTML = '';

      modules.forEach(function (m) {
        var card = document.createElement('div');
        card.className = 'module-card' + (m.enabled ? '' : ' module-disabled');
        card.innerHTML =
          '<div class="module-header">' +
          '<span class="module-icon">' + getIcon(m.icon) + '</span>' +
          '<h3>' + m.name + '</h3>' +
          '</div>' +
          '<p class="module-desc">' + (m.description || '') + '</p>' +
          '<div class="module-footer">' +
          '<span class="badge badge-' + (m.enabled ? 'success' : 'default') + '">' + (m.enabled ? 'Ativo' : 'Inativo') + '</span>' +
          '<span class="text-muted">v' + m.version + '</span>' +
          '<label class="toggle">' +
          '<input type="checkbox" ' + (m.enabled ? 'checked' : '') + ' data-slug="' + m.slug + '">' +
          '<span class="toggle-slider"></span>' +
          '</label>' +
          '</div>';
        grid.appendChild(card);
      });

      // Bind toggle events
      grid.querySelectorAll('input[data-slug]').forEach(function (input) {
        input.addEventListener('change', function () {
          toggleModule(this.getAttribute('data-slug'), this.checked);
        });
      });

    } catch (err) {
      console.error('Erro ao carregar módulos:', err);
    }
  }

  async function toggleModule(slug, enabled) {
    try {
      await API.patch('/api/admin/modules/' + slug, { enabled: enabled });
      await loadModules();
      await loadStats();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  // ========== LOAD ==========
  Promise.all([loadStats(), loadUsers(), loadModules()]);
})();
