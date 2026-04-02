type QueryFn = (text: string, params?: any[]) => Promise<any>;

export async function up(query: QueryFn) {
  // Tabela de clientes
  await query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      razao_social VARCHAR(255),
      cnpj VARCHAR(20),
      cpf VARCHAR(14),
      email VARCHAR(255),
      telefone VARCHAR(20),
      whatsapp VARCHAR(20),
      endereco TEXT,
      cidade VARCHAR(100),
      estado VARCHAR(2),
      cep VARCHAR(10),
      observacoes TEXT,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Tabela de serviços
  await query(`
    CREATE TABLE IF NOT EXISTS servicos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      tipo VARCHAR(100),
      status VARCHAR(50) DEFAULT 'ativo',
      url_site VARCHAR(500),
      url_admin VARCHAR(500),
      url_banco VARCHAR(500),
      ip_servidor VARCHAR(45),
      porta INTEGER,
      banco_nome VARCHAR(255),
      banco_usuario VARCHAR(255),
      credenciais TEXT,
      valor_mensal DECIMAL(10,2),
      data_inicio DATE,
      data_vencimento DATE,
      observacoes TEXT,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Links extras dos serviços (para múltiplos links)
  await query(`
    CREATE TABLE IF NOT EXISTS servico_links (
      id SERIAL PRIMARY KEY,
      servico_id INTEGER REFERENCES servicos(id) ON DELETE CASCADE,
      titulo VARCHAR(255) NOT NULL,
      url VARCHAR(500) NOT NULL,
      tipo VARCHAR(50) DEFAULT 'outro',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Índices
  await query(`CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_servicos_cliente ON servicos(cliente_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_servicos_status ON servicos(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_servicos_ativo ON servicos(ativo)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_servico_links_servico ON servico_links(servico_id)`);

  // Registrar módulos
  await query(`
    INSERT INTO modules (slug, name, description, icon, menu_order)
    VALUES
      ('clientes', 'Clientes', 'Gestão de clientes, contatos e endereços', 'users', 2),
      ('servicos', 'Serviços', 'Gestão dos serviços prestados aos clientes', 'box', 3)
    ON CONFLICT (slug) DO NOTHING
  `);
}
