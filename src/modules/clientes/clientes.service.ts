import { query } from "../../config/database";

export async function list(filters?: { ativo?: boolean; busca?: string }) {
  let sql = "SELECT * FROM clientes";
  const params: any[] = [];
  const conditions: string[] = [];

  if (filters?.ativo !== undefined) {
    conditions.push(`ativo = $${params.length + 1}`);
    params.push(filters.ativo);
  }
  if (filters?.busca) {
    conditions.push(`(nome ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1} OR telefone ILIKE $${params.length + 1} OR cnpj ILIKE $${params.length + 1})`);
    params.push(`%${filters.busca}%`);
  }

  if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY nome";

  const result = await query(sql, params);
  return result.rows;
}

export async function getById(id: number) {
  const result = await query(
    `SELECT c.*,
       COALESCE(
         (SELECT json_agg(json_build_object('id', s.id, 'nome', s.nome, 'tipo', s.tipo, 'status', s.status, 'ativo', s.ativo))
          FROM servicos s WHERE s.cliente_id = c.id),
         '[]'
       ) as servicos
     FROM clientes c WHERE c.id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Cliente não encontrado"), { status: 404 });
  }
  return result.rows[0];
}

export async function create(data: {
  nome: string; razao_social?: string; cnpj?: string; cpf?: string;
  email?: string; telefone?: string; whatsapp?: string;
  endereco?: string; cidade?: string; estado?: string; cep?: string;
  observacoes?: string;
}) {
  const result = await query(
    `INSERT INTO clientes (nome, razao_social, cnpj, cpf, email, telefone, whatsapp, endereco, cidade, estado, cep, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [data.nome, data.razao_social, data.cnpj, data.cpf, data.email, data.telefone, data.whatsapp, data.endereco, data.cidade, data.estado, data.cep, data.observacoes]
  );
  return result.rows[0];
}

export async function update(id: number, data: Record<string, any>) {
  const allowed = ["nome","razao_social","cnpj","cpf","email","telefone","whatsapp","endereco","cidade","estado","cep","observacoes","ativo"];
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
    `UPDATE clientes SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (result.rows.length === 0) throw Object.assign(new Error("Cliente não encontrado"), { status: 404 });
  return result.rows[0];
}

export async function remove(id: number) {
  const result = await query("DELETE FROM clientes WHERE id = $1 RETURNING id, nome", [id]);
  if (result.rows.length === 0) throw Object.assign(new Error("Cliente não encontrado"), { status: 404 });
  return result.rows[0];
}

export async function getStats() {
  const result = await query(
    `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE ativo = true) as ativos,
            (SELECT COUNT(*) FROM servicos) as total_servicos
     FROM clientes`
  );
  return result.rows[0];
}
