import bcrypt from "bcrypt";
import { query } from "../../config/database";

// ==================== USERS ====================

export async function listUsers() {
  const result = await query(
    `SELECT id, username, email, display_name, role, active, last_login, created_at
     FROM users ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getUser(id: number) {
  const result = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.role, u.active, u.last_login, u.created_at,
            COALESCE(
              json_agg(
                json_build_object('module', p.module_slug, 'read', p.can_read, 'write', p.can_write, 'delete', p.can_delete, 'admin', p.can_admin)
              ) FILTER (WHERE p.module_slug IS NOT NULL),
              '[]'
            ) as permissions
     FROM users u
     LEFT JOIN user_module_permissions p ON u.id = p.user_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [id]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuário não encontrado"), { status: 404 });
  }
  return result.rows[0];
}

export async function createUser(data: {
  username: string;
  email?: string;
  password: string;
  displayName?: string;
  role?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const result = await query(
    `INSERT INTO users (username, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, display_name, role, active, created_at`,
    [data.username, data.email || null, passwordHash, data.displayName || data.username, data.role || "user"]
  );
  return result.rows[0];
}

export async function updateUser(id: number, data: {
  email?: string;
  displayName?: string;
  role?: string;
  active?: boolean;
  password?: string;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }
  if (data.displayName !== undefined) { fields.push(`display_name = $${idx++}`); values.push(data.displayName); }
  if (data.role !== undefined) { fields.push(`role = $${idx++}`); values.push(data.role); }
  if (data.active !== undefined) { fields.push(`active = $${idx++}`); values.push(data.active); }
  if (data.password) {
    const hash = await bcrypt.hash(data.password, 12);
    fields.push(`password_hash = $${idx++}`);
    values.push(hash);
  }

  if (fields.length === 0) {
    throw Object.assign(new Error("Nenhum campo para atualizar"), { status: 400 });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, username, email, display_name, role, active`,
    values
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuário não encontrado"), { status: 404 });
  }
  return result.rows[0];
}

export async function deleteUser(id: number) {
  const result = await query("DELETE FROM users WHERE id = $1 RETURNING id, username", [id]);
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuário não encontrado"), { status: 404 });
  }
  return result.rows[0];
}

// ==================== MODULES ====================

export async function listModules() {
  const result = await query(
    "SELECT * FROM modules ORDER BY menu_order, name"
  );
  return result.rows;
}

export async function toggleModule(slug: string, enabled: boolean) {
  const result = await query(
    "UPDATE modules SET enabled = $1, updated_at = NOW() WHERE slug = $2 RETURNING *",
    [enabled, slug]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Módulo não encontrado"), { status: 404 });
  }
  return result.rows[0];
}

// ==================== PERMISSIONS ====================

export async function setUserPermission(userId: number, moduleSlug: string, permissions: {
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  canAdmin?: boolean;
}) {
  const result = await query(
    `INSERT INTO user_module_permissions (user_id, module_slug, can_read, can_write, can_delete, can_admin)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, module_slug) DO UPDATE SET
       can_read = COALESCE($3, user_module_permissions.can_read),
       can_write = COALESCE($4, user_module_permissions.can_write),
       can_delete = COALESCE($5, user_module_permissions.can_delete),
       can_admin = COALESCE($6, user_module_permissions.can_admin)
     RETURNING *`,
    [userId, moduleSlug, permissions.canRead ?? true, permissions.canWrite ?? false, permissions.canDelete ?? false, permissions.canAdmin ?? false]
  );
  return result.rows[0];
}

// ==================== STATS ====================

export async function getSystemStats() {
  const [users, modules, sessions] = await Promise.all([
    query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active = true) as active FROM users"),
    query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE enabled = true) as enabled FROM modules"),
    query("SELECT COUNT(*) as total FROM sessions WHERE expires_at > NOW()"),
  ]);

  return {
    users: { total: parseInt(users.rows[0].total), active: parseInt(users.rows[0].active) },
    modules: { total: parseInt(modules.rows[0].total), enabled: parseInt(modules.rows[0].enabled) },
    activeSessions: parseInt(sessions.rows[0].total),
  };
}
