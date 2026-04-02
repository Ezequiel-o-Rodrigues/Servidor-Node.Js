(function () {
  initApp('servicos');
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-sidebar').addEventListener('click', toggleSidebar);

  var modal = document.getElementById('modal-overlay');
  var form = document.getElementById('servico-form');
  var linkModal = document.getElementById('link-modal');
  var linkForm = document.getElementById('link-form');
  var detalheSection = document.getElementById('detalhe-section');

  // Pegar cliente_id da URL se existir
  var urlParams = new URLSearchParams(window.location.search);
  var filtroClienteId = urlParams.get('cliente_id');

  document.getElementById('btn-modal-close').addEventListener('click', function () { modal.hidden = true; });
  document.getElementById('btn-modal-cancel').addEventListener('click', function () { modal.hidden = true; });
  document.getElementById('btn-link-close').addEventListener('click', function () { linkModal.hidden = true; });
  document.getElementById('btn-link-cancel').addEventListener('click', function () { linkModal.hidden = true; });
  document.getElementById('btn-fechar-detalhe').addEventListener('click', function () { detalheSection.hidden = true; });

  document.getElementById('btn-novo').addEventListener('click', function () {
    document.getElementById('modal-title').textContent = 'Novo Serviço';
    form.reset();
    document.getElementById('edit-id').value = '';
    if (filtroClienteId) document.getElementById('f-cliente').value = filtroClienteId;
    modal.hidden = false;
  });

  var buscaTimer;
  document.getElementById('busca').addEventListener('input', function () {
    clearTimeout(buscaTimer);
    var val = this.value;
    buscaTimer = setTimeout(function () { loadServicos(val); }, 300);
  });

  // Carregar lista de clientes para o select
  async function loadClienteSelect() {
    try {
      var clientes = await API.get('/api/clientes');
      var sel = document.getElementById('f-cliente');
      clientes.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nome;
        sel.appendChild(opt);
      });
    } catch (e) { console.error(e); }
  }

  async function loadStats() {
    try {
      var s = await API.get('/api/servicos/stats');
      document.getElementById('stat-total').textContent = s.total;
      document.getElementById('stat-ativos').textContent = s.ativos;
      document.getElementById('stat-inativos').textContent = s.inativos;
      document.getElementById('stat-clientes').textContent = s.clientes_atendidos;
    } catch (e) { console.error(e); }
  }

  async function loadServicos(busca) {
    try {
      var url = '/api/servicos';
      var params = [];
      if (busca) params.push('busca=' + encodeURIComponent(busca));
      if (filtroClienteId) params.push('cliente_id=' + filtroClienteId);
      if (params.length) url += '?' + params.join('&');

      var servicos = await API.get(url);
      var tbody = document.getElementById('servicos-tbody');
      if (servicos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-secondary)">Nenhum serviço cadastrado</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      servicos.forEach(function (s) {
        var tr = document.createElement('tr');
        var statusBadge = s.ativo ? 'success' : 'default';
        var siteLink = s.url_site ? '<a href="' + s.url_site + '" target="_blank" style="color:var(--primary)">Abrir</a>' : '-';
        var valor = s.valor_mensal ? 'R$ ' + parseFloat(s.valor_mensal).toFixed(2) : '-';
        tr.innerHTML =
          '<td><strong>' + s.nome + '</strong>' + (s.descricao ? '<br><small style="color:var(--text-secondary)">' + s.descricao.substring(0, 50) + '</small>' : '') + '</td>' +
          '<td>' + (s.cliente_nome || '<em style="color:var(--text-secondary)">Sem cliente</em>') + '</td>' +
          '<td>' + (s.tipo || '-') + '</td>' +
          '<td><span class="badge badge-' + statusBadge + '">' + s.status + '</span></td>' +
          '<td>' + siteLink + '</td>' +
          '<td>' + valor + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-xs btn-ver" data-id="' + s.id + '">Ver</button> ' +
            '<button class="btn btn-ghost btn-xs btn-edit" data-id="' + s.id + '">Editar</button> ' +
            '<button class="btn btn-ghost btn-xs btn-toggle" data-id="' + s.id + '" data-ativo="' + s.ativo + '">' + (s.ativo ? 'Desativar' : 'Ativar') + '</button> ' +
            '<button class="btn btn-ghost btn-xs text-danger btn-del" data-id="' + s.id + '" data-nome="' + s.nome + '">Excluir</button>' +
          '</td>';
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-ver').forEach(function (b) { b.addEventListener('click', function () { verDetalhe(parseInt(this.getAttribute('data-id'))); }); });
      tbody.querySelectorAll('.btn-edit').forEach(function (b) { b.addEventListener('click', function () { editServico(parseInt(this.getAttribute('data-id'))); }); });
      tbody.querySelectorAll('.btn-toggle').forEach(function (b) { b.addEventListener('click', function () { toggleServico(parseInt(this.getAttribute('data-id')), this.getAttribute('data-ativo') !== 'true'); }); });
      tbody.querySelectorAll('.btn-del').forEach(function (b) { b.addEventListener('click', function () { delServico(parseInt(this.getAttribute('data-id')), this.getAttribute('data-nome')); }); });
    } catch (e) { console.error(e); }
  }

  async function verDetalhe(id) {
    try {
      var s = await API.get('/api/servicos/' + id);
      document.getElementById('detalhe-nome').textContent = s.nome;
      var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
      html += '<div><strong>Cliente:</strong> ' + (s.cliente_nome || 'Sem cliente') + '</div>';
      html += '<div><strong>Tipo:</strong> ' + (s.tipo || '-') + '</div>';
      html += '<div><strong>Status:</strong> <span class="badge badge-' + (s.ativo ? 'success' : 'default') + '">' + s.status + '</span></div>';
      html += '<div><strong>Valor:</strong> ' + (s.valor_mensal ? 'R$ ' + parseFloat(s.valor_mensal).toFixed(2) : '-') + '</div>';
      if (s.url_site) html += '<div><strong>Site:</strong> <a href="' + s.url_site + '" target="_blank">' + s.url_site + '</a></div>';
      if (s.url_admin) html += '<div><strong>Admin:</strong> <a href="' + s.url_admin + '" target="_blank">' + s.url_admin + '</a></div>';
      if (s.url_banco) html += '<div><strong>Banco URL:</strong> <a href="' + s.url_banco + '" target="_blank">' + s.url_banco + '</a></div>';
      if (s.ip_servidor) html += '<div><strong>IP:</strong> ' + s.ip_servidor + (s.porta ? ':' + s.porta : '') + '</div>';
      if (s.banco_nome) html += '<div><strong>Banco:</strong> ' + s.banco_nome + '</div>';
      if (s.banco_usuario) html += '<div><strong>User BD:</strong> ' + s.banco_usuario + '</div>';
      if (s.credenciais) html += '<div><strong>Credenciais:</strong> <code>' + s.credenciais + '</code></div>';
      if (s.data_inicio) html += '<div><strong>Início:</strong> ' + new Date(s.data_inicio).toLocaleDateString('pt-BR') + '</div>';
      if (s.data_vencimento) html += '<div><strong>Vencimento:</strong> ' + new Date(s.data_vencimento).toLocaleDateString('pt-BR') + '</div>';
      html += '</div>';
      if (s.descricao) html += '<div style="margin-top:16px"><strong>Descrição:</strong><p>' + s.descricao + '</p></div>';
      if (s.observacoes) html += '<div style="margin-top:8px"><strong>Observações:</strong><p>' + s.observacoes + '</p></div>';

      // Links
      html += '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Links</strong><button class="btn btn-primary btn-xs" id="btn-add-link" data-id="' + s.id + '">+ Link</button></div>';
      if (s.links && s.links.length > 0) {
        html += '<div style="display:flex;flex-direction:column;gap:4px">';
        s.links.forEach(function (l) {
          html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><span class="badge badge-default">' + l.tipo + '</span><a href="' + l.url + '" target="_blank">' + l.titulo + '</a><button class="btn btn-ghost btn-xs text-danger btn-del-link" data-id="' + l.id + '" style="margin-left:auto">x</button></div>';
        });
        html += '</div>';
      } else {
        html += '<p style="color:var(--text-secondary);font-size:13px">Nenhum link adicionado</p>';
      }
      html += '</div>';

      document.getElementById('detalhe-content').innerHTML = html;
      detalheSection.hidden = false;
      detalheSection.scrollIntoView({ behavior: 'smooth' });

      // Bind link buttons
      var addLinkBtn = document.getElementById('btn-add-link');
      if (addLinkBtn) {
        addLinkBtn.addEventListener('click', function () {
          document.getElementById('link-servico-id').value = this.getAttribute('data-id');
          linkForm.reset();
          linkModal.hidden = false;
        });
      }
      document.querySelectorAll('.btn-del-link').forEach(function (b) {
        b.addEventListener('click', function () { delLink(parseInt(this.getAttribute('data-id')), id); });
      });
    } catch (e) { alert('Erro: ' + e.message); }
  }

  async function editServico(id) {
    try {
      var s = await API.get('/api/servicos/' + id);
      document.getElementById('modal-title').textContent = 'Editar Serviço';
      document.getElementById('edit-id').value = id;
      document.getElementById('f-nome').value = s.nome || '';
      document.getElementById('f-cliente').value = s.cliente_id || '';
      document.getElementById('f-tipo').value = s.tipo || '';
      document.getElementById('f-descricao').value = s.descricao || '';
      document.getElementById('f-url-site').value = s.url_site || '';
      document.getElementById('f-url-admin').value = s.url_admin || '';
      document.getElementById('f-url-banco').value = s.url_banco || '';
      document.getElementById('f-ip').value = s.ip_servidor || '';
      document.getElementById('f-porta').value = s.porta || '';
      document.getElementById('f-banco-nome').value = s.banco_nome || '';
      document.getElementById('f-banco-user').value = s.banco_usuario || '';
      document.getElementById('f-credenciais').value = s.credenciais || '';
      document.getElementById('f-valor').value = s.valor_mensal || '';
      document.getElementById('f-inicio').value = s.data_inicio ? s.data_inicio.split('T')[0] : '';
      document.getElementById('f-vencimento').value = s.data_vencimento ? s.data_vencimento.split('T')[0] : '';
      document.getElementById('f-obs').value = s.observacoes || '';
      modal.hidden = false;
    } catch (e) { alert('Erro: ' + e.message); }
  }

  async function toggleServico(id, ativo) {
    try { await API.patch('/api/servicos/' + id + '/toggle', { ativo: ativo }); loadServicos(); loadStats(); } catch (e) { alert('Erro: ' + e.message); }
  }

  async function delServico(id, nome) {
    if (!confirm('Excluir o serviço "' + nome + '"? Essa ação não pode ser desfeita.')) return;
    try { await API.delete('/api/servicos/' + id); detalheSection.hidden = true; loadServicos(); loadStats(); } catch (e) { alert('Erro: ' + e.message); }
  }

  async function delLink(linkId, servicoId) {
    if (!confirm('Remover este link?')) return;
    try { await API.delete('/api/servicos/links/' + linkId); verDetalhe(servicoId); } catch (e) { alert('Erro: ' + e.message); }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = document.getElementById('edit-id').value;
    var data = {
      nome: document.getElementById('f-nome').value,
      cliente_id: document.getElementById('f-cliente').value ? parseInt(document.getElementById('f-cliente').value) : undefined,
      tipo: document.getElementById('f-tipo').value || undefined,
      descricao: document.getElementById('f-descricao').value || undefined,
      url_site: document.getElementById('f-url-site').value || undefined,
      url_admin: document.getElementById('f-url-admin').value || undefined,
      url_banco: document.getElementById('f-url-banco').value || undefined,
      ip_servidor: document.getElementById('f-ip').value || undefined,
      porta: document.getElementById('f-porta').value ? parseInt(document.getElementById('f-porta').value) : undefined,
      banco_nome: document.getElementById('f-banco-nome').value || undefined,
      banco_usuario: document.getElementById('f-banco-user').value || undefined,
      credenciais: document.getElementById('f-credenciais').value || undefined,
      valor_mensal: document.getElementById('f-valor').value ? parseFloat(document.getElementById('f-valor').value) : undefined,
      data_inicio: document.getElementById('f-inicio').value || undefined,
      data_vencimento: document.getElementById('f-vencimento').value || undefined,
      observacoes: document.getElementById('f-obs').value || undefined,
    };
    try {
      if (id) { await API.put('/api/servicos/' + id, data); }
      else { await API.post('/api/servicos', data); }
      modal.hidden = true;
      loadServicos();
      loadStats();
    } catch (e) { alert('Erro: ' + e.message); }
  });

  linkForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var servicoId = document.getElementById('link-servico-id').value;
    try {
      await API.post('/api/servicos/' + servicoId + '/links', {
        titulo: document.getElementById('f-link-titulo').value,
        url: document.getElementById('f-link-url').value,
        tipo: document.getElementById('f-link-tipo').value,
      });
      linkModal.hidden = true;
      verDetalhe(parseInt(servicoId));
    } catch (e) { alert('Erro: ' + e.message); }
  });

  loadClienteSelect();
  loadStats();
  loadServicos();
})();
