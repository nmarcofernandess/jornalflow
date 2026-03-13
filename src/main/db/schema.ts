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
        produto_id INT REFERENCES produtos(produto_id) ON DELETE CASCADE,
        arquivo_path TEXT NOT NULL,
        nome_original TEXT,
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
  },
  {
    version: 2,
    up: `
      ALTER TABLE produto_imagens ALTER COLUMN produto_id DROP NOT NULL;
      ALTER TABLE produto_imagens ADD COLUMN IF NOT EXISTS nome_original TEXT;
    `
  },
  {
    version: 3,
    up: `
      CREATE TABLE configuracao_ia (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'gemini',
        api_key TEXT,
        modelo TEXT,
        provider_configs_json TEXT DEFAULT '{}',
        ativo BOOLEAN NOT NULL DEFAULT true,
        memoria_automatica BOOLEAN NOT NULL DEFAULT true,
        criada_em TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO configuracao_ia (provider, modelo)
        VALUES ('gemini', 'gemini-2.0-flash');

      CREATE TABLE ia_conversas (
        id TEXT PRIMARY KEY,
        titulo TEXT,
        status TEXT NOT NULL DEFAULT 'ativo',
        resumo_compactado TEXT,
        criada_em TIMESTAMPTZ DEFAULT NOW(),
        atualizada_em TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX idx_ia_conversas_status
        ON ia_conversas (status, atualizada_em);

      CREATE TABLE ia_mensagens (
        id TEXT PRIMARY KEY,
        conversa_id TEXT NOT NULL REFERENCES ia_conversas(id) ON DELETE CASCADE,
        papel TEXT NOT NULL,
        conteudo TEXT,
        tool_calls_json TEXT,
        anexos_meta_json TEXT,
        criada_em TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX idx_ia_mensagens_conversa
        ON ia_mensagens (conversa_id, criada_em);
    `
  },
  {
    version: 4,
    up: `
      CREATE TABLE knowledge_sources (
        id SERIAL PRIMARY KEY,
        tipo TEXT NOT NULL DEFAULT 'manual',
        titulo TEXT NOT NULL,
        conteudo_original TEXT,
        metadata JSONB DEFAULT '{}',
        importance TEXT NOT NULL DEFAULT 'low',
        ativo BOOLEAN NOT NULL DEFAULT true,
        criada_em TIMESTAMPTZ DEFAULT NOW(),
        atualizada_em TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE knowledge_chunks (
        id SERIAL PRIMARY KEY,
        source_id INT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
        conteudo TEXT NOT NULL,
        embedding vector(768),
        search_tsv TSVECTOR,
        importance TEXT NOT NULL DEFAULT 'low',
        access_count INT NOT NULL DEFAULT 0,
        last_accessed_at TIMESTAMPTZ,
        criada_em TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX idx_kchunks_source ON knowledge_chunks(source_id);
      CREATE INDEX idx_kchunks_fts ON knowledge_chunks USING GIN(search_tsv);
      CREATE INDEX idx_kchunks_trgm ON knowledge_chunks USING GIN(conteudo gin_trgm_ops);
    `
  },
  {
    version: 5,
    up: `
      CREATE TABLE ia_memorias (
        id SERIAL PRIMARY KEY,
        conteudo TEXT NOT NULL,
        origem TEXT NOT NULL DEFAULT 'manual',
        embedding vector(768),
        criada_em TIMESTAMPTZ DEFAULT NOW(),
        atualizada_em TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX idx_ia_memorias_origem ON ia_memorias(origem);
    `
  },
  {
    version: 6,
    up: `
      CREATE TABLE knowledge_entities (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        embedding vector(768),
        origem TEXT NOT NULL DEFAULT 'sistema',
        valid_from TIMESTAMPTZ DEFAULT NOW(),
        valid_to TIMESTAMPTZ,
        UNIQUE(nome, tipo)
      );

      CREATE TABLE knowledge_relations (
        id SERIAL PRIMARY KEY,
        entity_from_id INT NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
        entity_to_id INT NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
        tipo_relacao TEXT NOT NULL,
        peso REAL NOT NULL DEFAULT 0.5,
        valid_from TIMESTAMPTZ DEFAULT NOW(),
        valid_to TIMESTAMPTZ
      );

      CREATE INDEX idx_knowledge_relations_from ON knowledge_relations(entity_from_id);
      CREATE INDEX idx_knowledge_relations_to ON knowledge_relations(entity_to_id);
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
