type QueryFn = (text: string, params?: any[]) => Promise<any>;

export async function up(query: QueryFn) {
  await query(`
    CREATE TABLE IF NOT EXISTS user_ssh_keys (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      public_key TEXT NOT NULL,
      fingerprint VARCHAR(255) NOT NULL,
      key_type VARCHAR(50) NOT NULL,
      last_used TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, fingerprint)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ssh_challenges (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      challenge VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_ssh_keys_user ON user_ssh_keys(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ssh_keys_fingerprint ON user_ssh_keys(fingerprint)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ssh_challenges_challenge ON ssh_challenges(challenge)`);
}
