(function () {
  initApp('clientes');
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-sidebar').addEventListener('click', toggleSidebar);

  var modal = document.getElementById('modal-overlay');
  var form = document.getElementById('cliente-form');

  document.getElementById('btn-novo').addEventListener('click', function () {
    document.getElementById('modal-title').textContent = 'Novo Cliente';
    form.reset();
    document.getElementById('edit-id').value = '';
    modal.hidden = false;
  });
  document.getElementById('btn-modal-close').addEventListener('click', function () { modal.hidden = true; });
  document.getElementById('btn-modal-cancel').addEventListener('click', function () { modal.hidden = true; });

  var buscaTimer;
  document.getElementById('busca').addEventListener('input', function () {
    clearTimeout(buscaTimer);
    var val = this.value;
    buscaTimer = setTimeout(function () { loadClientes(val); }, 300);
  });

  async function loadStats() {
    try {
      var s = await API.get('/api/clientes/stats');
      document.getElementById('stat-total').textContent = s.total;
      document.getElementById('stat-ativos').textContent = s.ativos;
      document.getElementById('stat-servicos').textContent = s.total_servicos;
    } catch (e) { console.error(e); }
  }

  async function loadClientes(busca) {
    try {
      var url = '/api/clientes';
      if (busca) url += '?busca=' + encodeURIComponent(busca);
      var clientes = await API.get(url);
      var tbody = document.getElementById('clientes-tbody');
      if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-secondary)">Nenhum cliente cadastrado</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      clientes.forEach(function (c) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><strong>' + c.nome + '</strong>' + (c.razao_social ? '<br><small style="color:var(--text-secondary)">' + c.razao_social + '</small>' : '') + '</td>' +
          '<td>' + (c.email || '-') + '</td>' +
          '<td>' + (c.telefone || c.whatsapp || '-') + '</td>' +
          '<td>' + (c.cidade ? c.cidade + '/' + (c.estado || '') : '-') + '</td>' +
          '<td><span class="badge badge-' + (c.ativo ? 'success' : 'default') + '">' + (c.ativo ? 'Sim' : 'Não') + '</span></td>' +
          '<td><button class="btn btn-ghost btn-xs btn-edit" data-id="' + c.id + '">Editar</button> <button class="btn btn-ghost btn-xs btn-servicos" data-id="' + c.id + '">Serviços</button> <button class="btn btn-ghost btn-xs text-danger btn-del" data-id="' + c.id + '" data-nome="' + c.nome + '">Excluir</button></td>';
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll('.btn-edit').forEach(function (b) { b.addEventListener('click', function () { editCliente(parseInt(this.getAttribute('data-id'))); }); });
      tbody.querySelectorAll('.btn-del').forEach(function (b) { b.addEventListener('click', function () { delCliente(parseInt(this.getAttribute('data-id')), this.getAttribute('data-nome')); }); });
      tbody.querySelectorAll('.btn-servicos').forEach(function (b) { b.addEventListener('click', function () { window.location.href = '/m/servicos/?cliente_id=' + this.getAttribute('data-id'); }); });
    } catch (e) { console.error(e); }
  }

  async function editCliente(id) {
    try {
      var c = await API.get('/api/clientes/' + id);
      document.getElementById('modal-title').textContent = 'Editar Cliente';
      document.getElementById('edit-id').value = id;
      document.getElementById('f-nome').value = c.nome || '';
      document.getElementById('f-razao').value = c.razao_social || '';
      document.getElementById('f-cnpj').value = c.cnpj || '';
      document.getElementById('f-cpf').value = c.cpf || '';
      document.getElementById('f-email').value = c.email || '';
      document.getElementById('f-telefone').value = c.telefone || '';
      document.getElementById('f-whatsapp').value = c.whatsapp || '';
      document.getElementById('f-endereco').value = c.endereco || '';
      document.getElementById('f-cidade').value = c.cidade || '';
      document.getElementById('f-estado').value = c.estado || '';
      document.getElementById('f-cep').value = c.cep || '';
      document.getElementById('f-obs').value = c.observacoes || '';
      modal.hidden = false;
    } catch (e) { alert('Erro: ' + e.message); }
  }

  async function delCliente(id, nome) {
    if (!confirm('Excluir o cliente "' + nome + '"? Os serviços vinculados perderão o vínculo.')) return;
    try { await API.delete('/api/clientes/' + id); loadClientes(); loadStats(); } catch (e) { alert('Erro: ' + e.message); }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = document.getElementById('edit-id').value;
    var data = {
      nome: document.getElementById('f-nome').value,
      razao_social: document.getElementById('f-razao').value || undefined,
      cnpj: document.getElementById('f-cnpj').value || undefined,
      cpf: document.getElementById('f-cpf').value || undefined,
      email: document.getElementById('f-email').value || undefined,
      telefone: document.getElementById('f-telefone').value || undefined,
      whatsapp: document.getElementById('f-whatsapp').value || undefined,
      endereco: document.getElementById('f-endereco').value || undefined,
      cidade: document.getElementById('f-cidade').value || undefined,
      estado: document.getElementById('f-estado').value || undefined,
      cep: document.getElementById('f-cep').value || undefined,
      observacoes: document.getElementById('f-obs').value || undefined,
    };
    try {
      if (id) { await API.put('/api/clientes/' + id, data); }
      else { await API.post('/api/clientes', data); }
      modal.hidden = true;
      loadClientes();
      loadStats();
    } catch (e) { alert('Erro: ' + e.message); }
  });

  loadStats();
  loadClientes();
})();
