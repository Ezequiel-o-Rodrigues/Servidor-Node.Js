(function () {
  // ========== ELEMENTS ==========
  var loginForm = document.getElementById('login-form');
  var errorEl = document.getElementById('error-message');
  var btnLogin = document.getElementById('btn-login');
  var tabPassword = document.getElementById('tab-password');
  var tabSSH = document.getElementById('tab-ssh');
  var sshLogin = document.getElementById('ssh-login');
  var sshStep1 = document.getElementById('ssh-step1');
  var sshStep2 = document.getElementById('ssh-step2');
  var sshChallengeForm = document.getElementById('ssh-challenge-form');
  var sshVerifyForm = document.getElementById('ssh-verify-form');
  var sshError = document.getElementById('ssh-error');
  var sshVerifyError = document.getElementById('ssh-verify-error');
  var sshCommand = document.getElementById('ssh-command');
  var btnCopyCmd = document.getElementById('btn-copy-cmd');
  var btnSshBack = document.getElementById('btn-ssh-back');

  var currentChallenge = '';
  var currentSSHUsername = '';

  // ========== CHECK IF LOGGED IN ==========
  API.get('/api/auth/profile').then(function () {
    window.location.href = '/app';
  }).catch(function () {});

  // ========== TABS ==========
  tabPassword.addEventListener('click', function () {
    tabPassword.classList.add('active');
    tabSSH.classList.remove('active');
    loginForm.hidden = false;
    sshLogin.hidden = true;
  });

  tabSSH.addEventListener('click', function () {
    tabSSH.classList.add('active');
    tabPassword.classList.remove('active');
    loginForm.hidden = true;
    sshLogin.hidden = false;
    sshStep1.hidden = false;
    sshStep2.hidden = true;
  });

  // ========== PASSWORD LOGIN ==========
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    btnLogin.querySelector('.btn-text').hidden = true;
    btnLogin.querySelector('.btn-loading').hidden = false;
    btnLogin.disabled = true;

    try {
      var data = await API.post('/api/auth/login', {
        username: loginForm.username.value,
        password: loginForm.password.value,
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

  // ========== SSH CHALLENGE ==========
  sshChallengeForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    sshError.hidden = true;
    currentSSHUsername = document.getElementById('ssh-username').value;

    try {
      var data = await API.post('/api/auth/ssh/challenge', {
        username: currentSSHUsername,
      });
      currentChallenge = data.challenge;
      sshCommand.textContent = data.instructions;
      sshStep1.hidden = true;
      sshStep2.hidden = false;
    } catch (err) {
      sshError.textContent = err.message || 'Erro ao gerar challenge';
      sshError.hidden = false;
    }
  });

  // ========== COPY COMMAND ==========
  btnCopyCmd.addEventListener('click', function () {
    var text = sshCommand.textContent;
    // Extrair só o comando (última linha)
    var lines = text.split('\n');
    var cmd = lines[lines.length - 1] || text;
    navigator.clipboard.writeText(cmd).then(function () {
      btnCopyCmd.textContent = 'Copiado!';
      setTimeout(function () { btnCopyCmd.textContent = 'Copiar comando'; }, 2000);
    });
  });

  // ========== SSH VERIFY ==========
  sshVerifyForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    sshVerifyError.hidden = true;

    try {
      var data = await API.post('/api/auth/ssh/verify', {
        username: currentSSHUsername,
        challenge: currentChallenge,
        signature: document.getElementById('ssh-signature').value.trim(),
      });
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      window.location.href = '/app';
    } catch (err) {
      sshVerifyError.textContent = err.message || 'Assinatura inválida';
      sshVerifyError.hidden = false;
    }
  });

  // ========== BACK BUTTON ==========
  btnSshBack.addEventListener('click', function () {
    sshStep1.hidden = false;
    sshStep2.hidden = true;
  });
})();
