(function () {
  initApp('home');

  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-sidebar').addEventListener('click', toggleSidebar);

  var user = JSON.parse(localStorage.getItem('user') || '{}');
  document.getElementById('welcome-name').textContent = user.displayName || user.username || 'Usuário';

  API.get('/api/auth/modules').then(function (modules) {
    var grid = document.getElementById('my-modules');
    grid.innerHTML = modules
      .filter(function (m) { return m.slug !== 'auth'; })
      .map(function (m) {
        return '<a href="/m/' + m.slug + '/" class="module-card" style="text-decoration:none;color:inherit">' +
          '<div class="module-header">' +
          '<span class="module-icon">' + getMenuIcon(m.icon) + '</span>' +
          '<h3>' + m.name + '</h3>' +
          '</div>' +
          '<p class="module-desc">' + (m.description || '') + '</p>' +
          '</a>';
      }).join('');
  }).catch(function (err) { console.error(err); });
})();
