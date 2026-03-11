import { getDb } from './database'

interface Migration {
  version: number
  up: string
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE lojas (
        loja_id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        endereco TEXT,
        telefone TEXT,
        horario_func TEXT,
        logo_path TEXT
      );

      CREATE TABLE produtos (
        produto_id SERIAL PRIMARY KEY,
        codigo TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        nome_card TEXT,
        unidade TEXT NOT NULL,
        categoria TEXT,
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE produto_imagens (
        imagem_id SERIAL PRIMARY KEY,
        produto_id INT NOT NULL REFERENCES produtos(produto_id) ON DELETE CASCADE,
        arquivo_path TEXT NOT NULL,
        variacao TEXT,
        is_default BOOLEAN DEFAULT false,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE template_secoes (
        secao_id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        nome_display TEXT NOT NULL,
        posicao INT NOT NULL,
        pagina INT NOT NULL,
        lado TEXT,
        grid_cols INT DEFAULT 3,
        grid_rows INT DEFAULT 3,
        bg_path TEXT,
        header_path TEXT,
        cor_tema TEXT
      );

      CREATE TABLE secao_aliases (
        alias_id SERIAL PRIMARY KEY,
        secao_id INT NOT NULL REFERENCES template_secoes(secao_id) ON DELETE CASCADE,
        alias TEXT UNIQUE NOT NULL
      );

      CREATE TABLE jornais (
        jornal_id SERIAL PRIMARY KEY,
        titulo TEXT,
        tipo TEXT DEFAULT 'semanal',
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        banner_path TEXT,
        status TEXT DEFAULT 'rascunho',
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE jornal_paginas (
        pagina_id SERIAL PRIMARY KEY,
        jornal_id INT NOT NULL REFERENCES jornais(jornal_id) ON DELETE CASCADE,
        numero INT NOT NULL,
        layout TEXT DEFAULT 'dupla',
        banner_path TEXT,
        UNIQUE(jornal_id, numero)
      );

      CREATE TABLE jornal_secoes (
        jornal_secao_id SERIAL PRIMARY KEY,
        jornal_id INT NOT NULL REFERENCES jornais(jornal_id) ON DELETE CASCADE,
        pagina_id INT NOT NULL REFERENCES jornal_paginas(pagina_id) ON DELETE CASCADE,
        template_secao_id INT REFERENCES template_secoes(secao_id) ON DELETE SET NULL,
        posicao INT NOT NULL,
        lado TEXT,
        grid_cols INT DEFAULT 3,
        grid_rows INT DEFAULT 3,
        nome_custom TEXT,
        bg_custom TEXT,
        header_custom TEXT
      );

      CREATE TABLE jornal_itens (
        item_id SERIAL PRIMARY KEY,
        jornal_id INT NOT NULL REFERENCES jornais(jornal_id) ON DELETE CASCADE,
        jornal_secao_id INT NOT NULL REFERENCES jornal_secoes(jornal_secao_id) ON DELETE CASCADE,
        posicao INT NOT NULL,
        produto_id INT NOT NULL REFERENCES produtos(produto_id) ON DELETE RESTRICT,
        preco_oferta DECIMAL(10,2) NOT NULL,
        preco_clube DECIMAL(10,2) NOT NULL,
        unidade_display TEXT,
        imagem_id INT REFERENCES produto_imagens(imagem_id),
        is_fallback BOOLEAN DEFAULT false,
        img_scale DECIMAL(4,2) DEFAULT 1.0,
        img_offset_x INT DEFAULT 0,
        img_offset_y INT DEFAULT 0,
        imgs_compostas JSONB,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE importacoes (
        importacao_id SERIAL PRIMARY KEY,
        jornal_id INT NOT NULL REFERENCES jornais(jornal_id) ON DELETE CASCADE,
        arquivo_nome TEXT NOT NULL,
        total_itens INT,
        matched INT,
        fallbacks INT,
        nao_encontrados INT,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `
  }
]

export async function applyMigrations(): Promise<void> {
  const db = await getDb()

  // Create migrations tracking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Get applied versions
  const applied = await db.query('SELECT version FROM _migrations ORDER BY version')
  const appliedVersions = new Set(applied.rows.map((r: any) => r.version))

  // Apply pending migrations
  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue

    try {
      await db.exec(`
        BEGIN;
        ${migration.up}
        INSERT INTO _migrations (version) VALUES (${migration.version});
        COMMIT;
      `)
    } catch (err) {
      await db.exec('ROLLBACK;')
      throw new Error(`Migration v${migration.version} failed: ${err}`)
    }
  }
}
