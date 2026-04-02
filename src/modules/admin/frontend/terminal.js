(function () {
  initApp('admin');
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-sidebar').addEventListener('click', toggleSidebar);

  var input = document.getElementById('terminal-input');
  var output = document.getElementById('terminal-output');
  var body = document.getElementById('terminal-body');
  var history = [];
  var historyIndex = -1;

  // Verificar se é super_admin
  var user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role !== 'super_admin') {
    output.innerHTML = '<div class="terminal-line"><span class="stderr">ACESSO NEGADO: Apenas super_admin pode usar o terminal.</span></div>';
    input.disabled = true;
    return;
  }

  function scrollToBottom() {
    body.scrollTop = body.scrollHeight;
  }

  function appendLine(html) {
    var div = document.createElement('div');
    div.className = 'terminal-line';
    div.innerHTML = html;
    output.appendChild(div);
    scrollToBottom();
  }

  async function runCommand(cmd) {
    cmd = cmd.trim();
    if (!cmd) return;

    // Adicionar ao histórico
    history.push(cmd);
    historyIndex = history.length;

    // Mostrar comando
    appendLine('<span class="prompt">root@servidor:~$ </span><span class="cmd">' + escapeHtml(cmd) + '</span>');

    // Comando local: clear
    if (cmd === 'clear') {
      output.innerHTML = '';
      return;
    }

    // Executar no servidor
    input.disabled = true;
    input.placeholder = 'Executando...';

    try {
      var result = await API.post('/api/admin/terminal', { command: cmd });

      if (result.stdout) {
        appendLine('<span class="stdout">' + escapeHtml(result.stdout) + '</span>');
      }
      if (result.stderr) {
        appendLine('<span class="stderr">' + escapeHtml(result.stderr) + '</span>');
      }
      if (result.code !== 0) {
        appendLine('<span class="info">exit code: ' + result.code + '</span>');
      }
    } catch (err) {
      appendLine('<span class="stderr">Erro: ' + escapeHtml(err.message) + '</span>');
    }

    appendLine('&nbsp;');
    input.disabled = false;
    input.placeholder = 'Digite um comando...';
    input.focus();
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Enter para executar
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var cmd = input.value;
      input.value = '';
      runCommand(cmd);
    }
    // Histórico com setas
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
      } else {
        historyIndex = history.length;
        input.value = '';
      }
    }
  });

  // Quick commands
  document.querySelectorAll('.quick-cmd').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cmd = this.getAttribute('data-cmd');
      input.value = cmd;
      runCommand(cmd);
    });
  });

  // Clear button
  document.getElementById('btn-clear').addEventListener('click', function () {
    output.innerHTML = '';
    appendLine('<span class="info">Terminal limpo.</span>');
    appendLine('&nbsp;');
  });

  // Focus no input ao clicar no terminal
  body.addEventListener('click', function () { input.focus(); });

  input.focus();
})();
