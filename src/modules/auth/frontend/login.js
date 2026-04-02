(function () {
  var form = document.getElementById('login-form');
  var errorEl = document.getElementById('error-message');
  var btnLogin = document.getElementById('btn-login');

  API.get('/api/auth/profile').then(function () {
    window.location.href = '/app';
  }).catch(function () {});

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    btnLogin.querySelector('.btn-text').hidden = true;
    btnLogin.querySelector('.btn-loading').hidden = false;
    btnLogin.disabled = true;

    try {
      var data = await API.post('/api/auth/login', {
        username: form.username.value,
        password: form.password.value,
      });
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      window.location.href = '/app';
    } catch (err) {
      errorEl.textContent = err.message || 'Erro ao fazer login';
      errorEl.hidden = false;
    } finally {
      btnLogin.querySelector('.btn-text').hidden = false;
      btnLogin.querySelector('.btn-loading').hidden = true;
      btnLogin.disabled = false;
    }
  });
})();
