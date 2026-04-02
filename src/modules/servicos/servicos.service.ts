import { query } from "../../config/database";

export async function list(filters?: { cliente_id?: number; ativo?: boolean; status?: string; busca?: string }) {
  let sql = `SELECT s.*, c.nome as cliente_nome
             FROM servicos s LEFT JOIN clientes c ON s.cliente_id = c.id`;
  const params: any[] = [];
  const conditions: string[] = [];

  if (filters?.cliente_id) { conditions.push(`s.cliente_id = $${params.length + 1}`); params.push(filters.cliente_id); }
  if (filters?.ativo !== undefined) { conditions.push(`s.ativo = $${params.length + 1}`); params.push(filters.ativo); }
  if (filters?.status) { conditions.push(`s.status = $${params.length + 1}`); params.push(filters.status); }
  if (filters?.busca) { conditions.push(`(s.nome ILIKE $${params.length + 1} OR s.descricao ILIKE $${params.length + 1})`); params.push(`%${filters.busca}%`); }

  if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY s.nome";

  const result = await query(sql, params);
  return result.rows;
}

export async function getById(id: number) {
  const result = await query(
    `SELECT s.*, c.nome as cliente_nome
     FROM servicos s LEFT JOIN clientes c ON s.cliente_id = c.id
     WHERE s.id = $1`,
    [id]
  );
  if (result.rows.length === 0) throw Object.assign(new Error("Serviço não encontrado"), { status: 404 });

  // Buscar links do serviço
  const links = await query("SELECT * FROM servico_links WHERE servico_id = $1 ORDER BY titulo", [id]);
  result.rows[0].links = links.rows;

  return result.rows[0];
}

export async function create(data: {
  nome: string; cliente_id?: number; descricao?: string; tipo?: string;
  url_site?: string; url_admin?: string; url_banco?: string;
  ip_servidor?: string; porta?: number; banco_nome?: string; banco_usuario?: string;
  credenciais?: string; valor_mensal?: number; data_inicio?: string; data_vencimento?: string;
  observacoes?: string;
}) {
  const result = await query(
    `INSERT INTO servicos (nome, cliente_id, descricao, tipo, url_site, url_admin, url_banco,
       ip_servidor, porta, banco_nome, banco_usuario, credenciais, valor_mensal, data_inicio, data_vencimento, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [data.nome, data.cliente_id || null, data.descricao, data.tipo,
     data.url_site, data.url_admin, data.url_banco,
     data.ip_servidor, data.porta, data.banco_nome, data.banco_usuario,
     data.credenciais, data.valor_mensal, data.data_inicio, data.data_vencimento, data.observacoes]
  );
  return result.rows[0];
}

export async function update(id: number, data: Record<string, any>) {
  const allowed = ["nome","cliente_id","descricao","tipo","status","url_site","url_admin","url_banco",
    "ip_servidor","porta","banco_nome","banco_usuario","credenciais","valor_mensal",
    "data_inicio","data_vencimento","observacoes","ativo"];
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }
  if (fields.length === 0) throw Object.assign(new Error("Nenhum campo para atualizar"), { status: 400 });

  fields.push("updated_at = NOW()");
  values.push(id);

  const result = await query(
    `UPDATE servicos SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (result.rows.length === 0) throw Object.assign(new Error("Serviço não encontrado"), { status: 404 });
  return result.rows[0];
}

export async function toggle(id: number, ativo: boolean) {
  const status = ativo ? "ativo" : "inativo";
  const result = await query(
    "UPDATE servicos SET ativo = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
    [ativo, status, id]
  );
  if (result.rows.length === 0) throw Object.assign(new Error("Serviço não encontrado"), { status: 404 });
  return result.rows[0];
}

export async function remove(id: number) {
  const result = await query("DELETE FROM servicos WHERE id = $1 RETURNING id, nome", [id]);
  if (result.rows.length === 0) throw Object.assign(new Error("Serviço não encontrado"), { status: 404 });
  return result.rows[0];
}

// Links
export async function addLink(servicoId: number, data: { titulo: string; url: string; tipo?: string }) {
  const result = await query(
    "INSERT INTO servico_links (servico_id, titulo, url, tipo) VALUES ($1,$2,$3,$4) RETURNING *",
    [servicoId, data.titulo, data.url, data.tipo || "outro"]
  );
  return result.rows[0];
}

export async function removeLink(linkId: number) {
  const result = await query("DELETE FROM servico_links WHERE id = $1 RETURNING *", [linkId]);
  if (result.rows.length === 0) throw Object.assign(new Error("Link não encontrado"), { status: 404 });
  return result.rows[0];
}

export async function getStats() {
  const result = await query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE ativo = true) as ativos,
            COUNT(*) FILTER (WHERE ativo = false) as inativos,
            COUNT(DISTINCT cliente_id) as clientes_atendidos
     FROM servicos`
  );
  return result.rows[0];
}
