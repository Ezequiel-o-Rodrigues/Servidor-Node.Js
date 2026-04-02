type QueryFn = (text: string, params?: any[]) => Promise<any>;

export async function up(query: QueryFn) {
  // Tabela de módulos do sistema
  await query(`
    CREATE TABLE IF NOT EXISTS modules (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      version VARCHAR(20) DEFAULT '1.0.0',
      enabled BOOLEAN DEFAULT true,
      icon VARCHAR(50) DEFAULT 'box',
      menu_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Tabela de usuários
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      active BOOLEAN DEFAULT true,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Permissões de módulo por usuário
  await query(`
    CREATE TABLE IF NOT EXISTS user_module_permissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      module_slug VARCHAR(100) REFERENCES modules(slug) ON DELETE CASCADE,
      can_read BOOLEAN DEFAULT true,
      can_write BOOLEAN DEFAULT false,
      can_delete BOOLEAN DEFAULT false,
      can_admin BOOLEAN DEFAULT false,
      granted_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, module_slug)
    )
  `);

  // Configurações de módulo (key-value flexível)
  await query(`
    CREATE TABLE IF NOT EXISTS module_config (
      id SERIAL PRIMARY KEY,
      module_slug VARCHAR(100) REFERENCES modules(slug) ON DELETE CASCADE,
      key VARCHAR(255) NOT NULL,
      value JSONB,
      UNIQUE(module_slug, key)
    )
  `);

  // Sessões ativas
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) UNIQUE NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Registrar módulos core
  await query(`
    INSERT INTO modules (slug, name, description, icon, menu_order)
    VALUES
      ('auth', 'Autenticação', 'Login, registro e gestão de sessões', 'shield', 0),
      ('admin', 'Administração', 'Painel administrativo e gestão do sistema', 'settings', 1)
    ON CONFLICT (slug) DO NOTHING
  `);

  // Índices para performance
  await query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_perms_user ON user_module_permissions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_modules_enabled ON modules(enabled)`);
}
