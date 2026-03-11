# JornalFlow — Design Spec

## TL;DR

App desktop Electron que automatiza a criação de jornais de ofertas do Supermercado Fernandes. Importa planilha de produtos, faz match com banco de imagens, renderiza HTML/CSS, permite revisão/edição, exporta multi-formato via Puppeteer. IA assistente com ~15 tools.

## Problema

A esposa do Marco monta o jornal de ofertas semanalmente no Affinity Publisher de forma manual. Recebe uma planilha com ~45 produtos, busca fotos na internet ou em pasta local, posiciona um a um no layout. Processo repetitivo, demorado, propenso a erros.

## Solução

JornalFlow — um app desktop (Electron) que:
1. Importa a planilha de produtos com preços e seções
2. Faz match automático com banco de produtos/imagens local
3. Renderiza o jornal como HTML/CSS em template fixo
4. Permite revisão e edição via painel lateral com preview live
5. Exporta via Puppeteer em múltiplos formatos (PDF, PNG, Story, Carrossel)
6. Mantém histórico completo de todos os jornais

---

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Shell | Electron 34 |
| Build | electron-vite |
| IPC | @egoist/tipc (type-safe) |
| Frontend | React 19 + React Router |
| UI | shadcn/ui + Tailwind |
| State | Zustand |
| Database | PGlite (Postgres WASM) |
| IA | Vercel AI SDK + Gemini |
| Export | Puppeteer |
| Forms | react-hook-form + Zod |

---

## Banco de Dados (PGlite)

### lojas

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| loja_id | SERIAL PK | |
| nome | TEXT NOT NULL | "Sup Fernandes" |
| endereco | TEXT | |
| telefone | TEXT | |
| horario_func | TEXT | "SEG A SÁB: 8:00-19:00..." |
| logo_path | TEXT | |

### produtos

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| produto_id | SERIAL PK | |
| codigo | TEXT UNIQUE NOT NULL | SKU/barcode: "515", "5920" |
| nome | TEXT NOT NULL | "CERVEJA CRYSTAL 350ML LATA" |
| nome_card | TEXT | Nome formatado pro card (override) |
| unidade | TEXT NOT NULL | "KG", "UN", "100G", "PCT" |
| categoria | TEXT | "bebidas", "carnes", "hortifruti" |
| ativo | BOOLEAN DEFAULT true | |
| criado_em | TIMESTAMP DEFAULT NOW() | |
| atualizado_em | TIMESTAMP DEFAULT NOW() | |

### produto_imagens

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| imagem_id | SERIAL PK | |
| produto_id | INT FK produtos | |
| arquivo_path | TEXT NOT NULL | "data/images/products/515/crystal-lata.png" |
| variacao | TEXT | "sabor uva", "fragrância lavanda", NULL = genérica |
| is_default | BOOLEAN DEFAULT false | Fallback/wayout |
| criado_em | TIMESTAMP DEFAULT NOW() | |

### template_secoes

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| secao_id | SERIAL PK | |
| slug | TEXT UNIQUE NOT NULL | "acougue", "hortifruti", "mercearia" |
| nome_display | TEXT NOT NULL | "Açougue do Fernandes" |
| posicao | INT NOT NULL | Ordem no layout (1-5) |
| pagina | INT NOT NULL | Qual página (1, 2, 3) |
| lado | TEXT | "full", "esquerda", "direita" |
| grid_cols | INT DEFAULT 3 | |
| grid_rows | INT DEFAULT 3 | |
| bg_path | TEXT | Background da seção |
| header_path | TEXT | Banner/header da seção |
| cor_tema | TEXT | Cor dominante |

### secao_aliases

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| alias_id | SERIAL PK | |
| secao_id | INT FK template_secoes | |
| alias | TEXT UNIQUE NOT NULL | "ACOUGUE", "CASA-HIGIENE", "PEREC-MAT" |

### jornais

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| jornal_id | SERIAL PK | |
| titulo | TEXT | "Jornal Sup Fernandes 13-19/03" |
| tipo | TEXT DEFAULT 'semanal' | "semanal" ou "especial" |
| data_inicio | DATE NOT NULL | |
| data_fim | DATE NOT NULL | |
| banner_path | TEXT | Banner topo (ex: Sorteio de Páscoa) |
| status | TEXT DEFAULT 'rascunho' | rascunho, revisao, aprovado, exportado |
| criado_em | TIMESTAMP DEFAULT NOW() | |
| atualizado_em | TIMESTAMP DEFAULT NOW() | |

### jornal_paginas

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| pagina_id | SERIAL PK | |
| jornal_id | INT FK jornais | |
| numero | INT NOT NULL | 1, 2, 3, 4... |
| layout | TEXT DEFAULT 'dupla' | "full" ou "dupla" |
| banner_path | TEXT | Banner topo da página |
| UNIQUE(jornal_id, numero) | | |

### jornal_secoes

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| jornal_secao_id | SERIAL PK | (evita colisão com template_secoes.secao_id) |
| jornal_id | INT FK jornais | |
| pagina_id | INT FK jornal_paginas | |
| template_secao_id | INT FK template_secoes | Puxa visual (bg, header, cor) |
| posicao | INT NOT NULL | Ordem dentro da página |
| lado | TEXT | "full", "esquerda", "direita" |
| grid_cols | INT DEFAULT 3 | |
| grid_rows | INT DEFAULT 3 | |
| nome_custom | TEXT | Override do nome (seção nova) |
| bg_custom | TEXT | Override do background |
| header_custom | TEXT | Override do header |

### jornal_itens

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| item_id | SERIAL PK | |
| jornal_id | INT FK jornais | |
| jornal_secao_id | INT FK jornal_secoes | |
| posicao | INT NOT NULL | 1-9 dentro da seção |
| produto_id | INT FK produtos | |
| preco_oferta | DECIMAL(10,2) NOT NULL | |
| preco_clube | DECIMAL(10,2) NOT NULL | |
| unidade_display | TEXT | Override se diferente do cadastro |
| imagem_id | INT FK produto_imagens | Qual imagem usou |
| is_fallback | BOOLEAN DEFAULT false | IA usou wayout? |
| img_scale | DECIMAL(4,2) DEFAULT 1.0 | Zoom (1.0 = 100%, range 0.10-99.99) |
| img_offset_x | INT DEFAULT 0 | Reposição horizontal (px) |
| img_offset_y | INT DEFAULT 0 | Reposição vertical (px) |
| imgs_compostas | JSONB | Array de paths se 2-3 imagens (JSONB ao invés de TEXT[] por compatibilidade PGlite) |
| criado_em | TIMESTAMP DEFAULT NOW() | |

### importacoes

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| importacao_id | SERIAL PK | |
| jornal_id | INT FK jornais | |
| arquivo_nome | TEXT NOT NULL | |
| total_itens | INT | |
| matched | INT | Encontrados no banco |
| fallbacks | INT | Usaram wayout |
| nao_encontrados | INT | Sem imagem nenhuma |
| criado_em | TIMESTAMP DEFAULT NOW() | |

### Cascade Rules (FK)

| Tabela pai | Tabela filha | On Delete |
|------------|-------------|-----------|
| jornais | jornal_paginas | CASCADE (deletar jornal = deletar páginas) |
| jornais | jornal_itens | CASCADE |
| jornal_paginas | jornal_secoes | CASCADE |
| jornal_secoes | jornal_itens | CASCADE |
| produtos | jornal_itens | RESTRICT (não deleta produto com histórico) |
| produtos | produto_imagens | CASCADE (deletar produto = deletar imagens) |
| template_secoes | secao_aliases | CASCADE |
| template_secoes | jornal_secoes | SET NULL (template deletado, seção preservada) |

### Migrations

Estratégia incremental (mesmo padrão do EscalaFlow):
- `schema.ts` contém DDL completo + array de migrations versionadas
- Cada migration tem `version: number` + `up: string` (SQL)
- Tabela `_migrations` registra versions aplicadas
- Na inicialização: compara version atual do banco vs migrations disponíveis, aplica as pendentes em transaction
- Nunca altera migrations já aplicadas — só adiciona novas

```typescript
const MIGRATIONS: Migration[] = [
  { version: 1, up: '-- DDL inicial (todas as tabelas)' },
  { version: 2, up: 'ALTER TABLE produtos ADD COLUMN ...' },
  // futuras migrations aqui
]
```

### Seed Data (primeira execução)

`seed.ts` popula:
- 1 loja default (Sup Fernandes, endereço, telefone, horários)
- 5 template_secoes (acougue, hortifruti, mercearia, perec-mat, casa-higiene)
- 5 secao_aliases mapeando nomes da planilha
- template_secoes são imutáveis pelo usuário (só o dev modifica via migrations)
- Seções custom são criadas via jornal_secoes com nome_custom/bg_custom

### Data Directory (produção)

Em dev: `./data/` relativo ao projeto.
Em produção (packaged): `app.getPath('userData')` → `~/Library/Application Support/JornalFlow/` (macOS) ou `%APPDATA%/JornalFlow/` (Windows). Todos os paths no banco são relativos ao data dir, nunca absolutos.

---

## Fluxo Principal

### Jornal Semanal

```
Planilha (TSV/CSV)
  → Parser extrai: código, nome, preço, clube, seção, unidade
  → Matcher busca produto no banco por código
  → Auto-cria 3 páginas + 5 seções (layout padrão)
  → Preenche jornal_itens com match de imagens
  → Sinaliza: match exato, fallback, não encontrado
  → Preview renderiza HTML/CSS
  → Usuária revisa, ajusta no painel lateral
  → Exporta via Puppeteer (PDF, PNG, Story, Carrossel)
  → Arquiva no histórico
```

### Jornal Especial

```
Planilha SEM setor (só produtos soltos)
  → Parser extrai: código, nome, preço, clube
  → Produtos vão pro Pool (sem posição)
  → Usuária cria páginas e seções manualmente
  → Configura visual de cada seção (bg, header, grid)
  → Distribui produtos do pool pras seções
  → Revisa → Exporta → Arquiva
```

### Formato da Planilha (Input)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Produto | Numérico | Código/SKU do produto |
| Descrição | Texto | Nome completo com unidade |
| Preço Oferta | Decimal | Preço normal |
| Tipo Oferta | Texto | Seção (ACOUGUE, HORTIFRUTI, etc.) — vazio no modo especial |
| clube | Decimal | Preço Clube Fernandes |

#### Parser Rules

- **Delimitador**: auto-detect (TAB → TSV, vírgula ou ponto-e-vírgula → CSV). TAB é o default (planilha vem do sistema do supermercado)
- **Encoding**: UTF-8 (com fallback pra Latin-1/ISO-8859-1 se detectar caracteres quebrados)
- **Headers**: match por nome de coluna (case-insensitive, trim whitespace). Colunas esperadas: "Produto", "Descrição", "Preço Oferta", "Tipo Oferta", "clube"
- **Linhas vazias**: ignoradas (a planilha usa linhas em branco como separadores entre seções)
- **Validação por linha**: código obrigatório + numérico, preço obrigatório + numérico, descrição obrigatória. Linhas inválidas vão pra relatório de erros, não travam o import
- **Extração de unidade**: parser extrai unidade da descrição via regex patterns: `KG$`, `UN\.?$`, `\d+\s*(ML|GR|G|LT|LTS)`, `100G`, `PCT`. Salva como `unidade_display` no jornal_itens
- **Preço "de"**: o jornal NÃO mostra preço riscado "de/por". Só mostra preço oferta + preço clube. Isso é intencional — o formato do Sup Fernandes não usa preço anterior

Mapeamento Tipo Oferta → Seção:
- `ACOUGUE` → Açougue (pág 1, full, 9 produtos)
- `HORTIFRUTI` → Horti Fruti (pág 2 esq, 9 produtos)
- `MERCEARIA` → Mercearia (pág 2 dir, 9 produtos)
- `PEREC-MAT` → Padaria/Perecíveis (pág 3 esq, 9 produtos)
- `CASA-HIGIENE` → Casa & Higiene (pág 3 dir, 9 produtos)

---

## Layout do Jornal (Template)

### Estrutura de Páginas

| Página | Layout | Seções |
|--------|--------|--------|
| 1 (capa) | full | Açougue (3×3 = 9 produtos) |
| 2 | dupla | Horti Fruti (3×3) + Mercearia (3×3) |
| 3 | dupla | Padaria (3×3) + Casa & Higiene (3×3) |

### Elementos por Página

- Banner topo (imagem promocional, ex: Sorteio de Páscoa)
- Barra de datas ("Ofertas válidas de X a Y ou enquanto durarem os estoques")
- Seção com header temático (background + banner)
- Grid de cards de produto
- Rodapé com info da loja (última página)

### Card de Produto

```
┌─────────────────────┐
│   [IMAGEM(NS)]      │  1, 2 ou 3 imagens compostas
│   scale + offset    │  zoom/reposição via CSS
├─────────────────────┤
│  NOME DO PRODUTO    │  nome_card ou nome
├─────────────────────┤
│         ┌──────────┐│
│  45,98  │  CLUBE   ││  preço + badge clube
│    KG   │  44,98   ││
│         │    KG    ││
│         └──────────┘│
└─────────────────────┘
```

Composição de imagens:
- 1 imagem: `object-fit: cover` + `transform: scale()` + `object-position`
- 2 imagens: `display: flex` com 2 imgs
- 3 imagens: `display: flex` com 3 imgs

---

## Renderização (HTML/CSS)

O jornal é renderizado como HTML/CSS dentro de uma webview no Electron.

### Hierarquia de Componentes

```
<JornalPreview>
  <PaginaJornal numero={n} layout="full|dupla">
    <BannerTopo />
    <BarraDatas />
    <SecaoJornal template="slug" lado="full|esquerda|direita">
      <SecaoHeader />
      <GridProdutos cols={3} rows={3}>
        <CardProduto /> ×N
      </GridProdutos>
    </SecaoJornal>
    <RodapeLoja />  (última página)
  </PaginaJornal>
</JornalPreview>
```

### Export via Puppeteer

Cada elemento tem `data-export` attributes para captura seletiva:

| Export | Seletor | Dimensões | Formato |
|--------|---------|-----------|---------|
| PDF full | `[data-export^="pagina-"]` | A4/Custom | PDF |
| PNG por página | `[data-export^="pagina-"]` | 1080×1920 | PNG |
| Story | `[data-export^="secao-"]` | 1080×1920 | PNG |
| Carrossel | `[data-export^="pagina-"]` | 1080×1080 | PNG |

Output em `data/exports/{jornal-id}/`:
```
jornal-completo.pdf
jornal-pagina-1.png
jornal-pagina-2.png
jornal-pagina-3.png
story-acougue.png
story-hortifruti.png
story-mercearia.png
story-padaria.png
story-casa-higiene.png
carrossel-pagina-1.png
carrossel-pagina-2.png
carrossel-pagina-3.png
```

---

## Editor (UI)

Split view: painel de controle à esquerda, preview do jornal à direita.

### Painel Esquerdo

- **Import**: botão para importar planilha
- **Páginas**: tree view de páginas e seções (+ Página / + Seção)
- **Seção ativa**: lista de itens com status (match/fallback/missing)
- **Alertas**: fallbacks e produtos sem imagem pendentes
- **Item selecionado**: editor de campos (nome, preço, clube, unidade, imagem, zoom, offset, composição)

### Interações

| Ação | Como |
|------|------|
| Selecionar item | Clica no card na preview OU na lista do painel |
| Editar preço/nome | Input direto no painel → preview atualiza live |
| Trocar imagem | Modal com imagens do produto no banco |
| Zoom/reposição | Sliders no painel → preview atualiza live |
| Compor 2-3 imagens | Adiciona slots, escolhe imagens |
| Trocar produto | Busca no banco por nome/código |
| Reordenar | Drag na lista do painel |
| Adicionar página/seção | Botões no tree (modo especial) |

### Status Visual nos Cards

- Verde: match perfeito
- Amarelo: fallback (imagem wayout)
- Vermelho: sem imagem

---

## Sistema de IA (~15 Tools)

Chat lateral (slide-out), mesmo padrão do EscalaFlow. Vercel AI SDK + Gemini.

### Tools

| # | Tool | Descrição |
|---|------|-----------|
| 1 | buscar_produtos | Busca no catálogo por nome, código, categoria |
| 2 | ver_produto | Detalhe de 1 produto com imagens/variações |
| 3 | cadastrar_produto | Cria produto novo no banco |
| 4 | atualizar_produto | Edita nome, unidade, categoria |
| 5 | listar_imagens | Imagens de um produto e qual é default |
| 6 | definir_imagem_default | Seta imagem fallback/wayout |
| 7 | buscar_jornal_atual | Jornal em edição com todos os itens |
| 8 | trocar_item | Substitui produto numa posição/seção |
| 9 | atualizar_item | Muda preço, clube, imagem de um item |
| 10 | status_importacao | Resumo: matches, fallbacks, faltantes |
| 11 | buscar_historico | Jornais anteriores por data/produto |
| 12 | comparar_precos | Compara preços entre edições |
| 13 | listar_secoes | Seções do jornal atual e status |
| 14 | adicionar_secao | Cria seção nova (modo especial) |
| 15 | stats_banco | Estatísticas do catálogo |

### Discovery Layer (contexto automático)

| Contexto | Quando |
|----------|--------|
| Jornal em edição | Sempre que tem rascunho aberto |
| Alertas pendentes | Fallbacks, sem imagem, preço zerado |
| Stats do catálogo | Total produtos, cobertura de imagens |
| Última importação | Data, arquivo, resultado do match |

### Padrão de Resposta

- `toolOk({ data })` — sucesso
- `toolError(msg, correction)` — erro com sugestão
- `toolTruncated(data, total)` — resultado cortado

---

## Gestão de Imagens

### Estrutura de Pastas

```
data/
├── images/
│   ├── products/{codigo}/        ← organizado por código
│   │   ├── crystal-lata.png      ← default
│   │   └── crystal-lata-2.png    ← variação
│   └── assets/
│       ├── backgrounds/
│       ├── headers/
│       ├── banners/
│       └── loja/
├── exports/
└── pglite/
```

### Upload Individual

1. Produtos → seleciona produto → "Adicionar Imagem"
2. Escolhe arquivo (PNG/JPG/WebP)
3. Copia pra `data/images/products/{codigo}/`
4. Renomeia: `{nome-slug}-{variacao}.{ext}`
5. Registra no banco (produto_imagens)
6. Primeira imagem → seta como default

### Batch Import

1. "Importar Pasta de Imagens"
2. Lê todos os arquivos (PNG/JPG/WebP, recursivo)
3. Matching por código no nome do arquivo:
   - `515.png` → produto código 515 (match direto)
   - `515-crystal-lata.png` → produto código 515 (prefixo antes do primeiro `-`)
   - `crystal-lata.png` → sem match por código, tenta fuzzy por nome
   - Subpastas: `515/foto.png` → produto código 515 (nome da pasta)
4. Relatório: "120 importadas, 8 sem match"
5. Sem match → lista com preview pra usuária associar manualmente

### Variações

- Produto tem 1 imagem default (fallback/wayout)
- Variações cadastradas opcionalmente (fragrância, sabor)
- Se match exato encontra variação → usa ela
- Se não → usa fallback e sinaliza (is_fallback = true)
- IA informa: "Usei imagem genérica, não tinha fragrância X"

---

## Estrutura do Projeto

```
jornalflow/
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── tipc.ts
│   │   ├── db/
│   │   │   ├── database.ts
│   │   │   ├── schema.ts
│   │   │   ├── query.ts
│   │   │   └── seed.ts
│   │   ├── ia/
│   │   │   ├── sistema-prompt.ts
│   │   │   ├── tools.ts
│   │   │   ├── discovery.ts
│   │   │   ├── cliente.ts
│   │   │   └── config.ts
│   │   ├── import/
│   │   │   ├── parser.ts
│   │   │   ├── matcher.ts
│   │   │   └── batch-images.ts
│   │   └── export/
│   │       ├── engine.ts
│   │       ├── html-builder.ts
│   │       └── cuts.ts
│   ├── preload/
│   │   └── index.ts
│   ├── renderer/src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── paginas/
│   │   │   ├── Dashboard.tsx              # Landing: jornal ativo, stats, atalhos rápidos
│   │   │   ├── ProdutosLista.tsx
│   │   │   ├── ProdutoDetalhe.tsx
│   │   │   ├── EditorJornal.tsx
│   │   │   ├── HistoricoLista.tsx
│   │   │   ├── HistoricoDetalhe.tsx
│   │   │   ├── IaPagina.tsx               # Chat IA full page (mesmo conteúdo do panel, tela maior)
│   │   │   └── ConfiguracoesPagina.tsx
│   │   ├── componentes/
│   │   │   ├── jornal/
│   │   │   │   ├── JornalPreview.tsx
│   │   │   │   ├── PaginaJornal.tsx
│   │   │   │   ├── SecaoJornal.tsx
│   │   │   │   ├── CardProduto.tsx
│   │   │   │   ├── BannerTopo.tsx
│   │   │   │   ├── BarraDatas.tsx
│   │   │   │   └── RodapeLoja.tsx
│   │   │   ├── editor/
│   │   │   │   ├── PainelImport.tsx
│   │   │   │   ├── PainelSecoes.tsx
│   │   │   │   ├── PainelItem.tsx
│   │   │   │   ├── PainelAlertas.tsx
│   │   │   │   ├── ImagePicker.tsx
│   │   │   │   ├── ImageComposer.tsx
│   │   │   │   ├── PoolProdutos.tsx
│   │   │   │   └── ExportDialog.tsx
│   │   │   ├── produtos/
│   │   │   │   ├── ProdutoCard.tsx
│   │   │   │   ├── ImageUpload.tsx
│   │   │   │   └── BatchImport.tsx
│   │   │   └── ia/
│   │   │       ├── IaChatPanel.tsx
│   │   │       └── IaChatView.tsx
│   │   ├── components/ui/
│   │   ├── servicos/
│   │   │   ├── produtos.ts
│   │   │   ├── jornais.ts
│   │   │   ├── importacao.ts
│   │   │   ├── exportacao.ts
│   │   │   ├── ia.ts
│   │   │   └── configuracoes.ts
│   │   ├── store/
│   │   │   ├── editorStore.ts
│   │   │   ├── iaStore.ts
│   │   │   └── produtosStore.ts
│   │   └── lib/
│   │       ├── cn.ts
│   │       └── utils.ts
│   └── shared/
│       ├── types.ts
│       ├── constants.ts
│       └── index.ts
├── data/
│   ├── images/
│   ├── exports/
│   └── pglite/
├── tests/
│   ├── import/
│   ├── export/
│   ├── ia/
│   └── e2e/
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.node.json
├── tsconfig.web.json
├── tailwind.config.js
├── components.json
└── package.json
```

### Convenções

- `snake_case` ponta a ponta (DB → IPC → React)
- Componentes: `PascalCase.tsx`
- Serviços: `servicos/{entidade}.ts`
- Store: `{contexto}Store.ts`
- Shared types: tudo em `shared/types.ts`

---

## Escopo V1

### Entra

- Import planilha (TSV/CSV) com auto-match
- Banco de produtos com imagens e variações (fallback/wayout)
- Editor: painel lateral + preview live
- Jornal semanal (auto-layout) + especial (layout livre)
- Export: PDF, PNG, Story, Carrossel (Puppeteer)
- IA chat (~15 tools)
- Histórico de jornais
- Batch import de imagens

### Backlog (Não entra na V1)

- Nano Banana: edição de imagem por IA (API paga)
- Busca de imagem na web (Google Images API)
- Auto-crop / remoção de fundo
- Local LLM
- Auto-update / CI/CD
- XLSX nativo (começa com TSV/CSV)

---

## Riscos & Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Puppeteer pesado no Electron | Bundle grande (~100MB+) | puppeteer-core + Chromium do Electron (ver seção Puppeteer Integration abaixo) |
| Imagens grandes no HTML/base64 | Export lento | Otimizar imagens no upload (resize, compressão) |
| Fonte do preço não replicar | Visual diferente | Testar fontes early, pode precisar de custom |
| Match fuzzy falhar | Produto errado | Match por código (exato), fuzzy só como sugestão |

### Puppeteer Integration (Electron)

Usar `puppeteer-core` (sem Chromium bundled) + Chromium que já vem com o Electron:

```typescript
import puppeteer from 'puppeteer-core'
import { app } from 'electron'
import path from 'path'

function getChromiumPath(): string {
  if (app.isPackaged) {
    // Em produção: Chromium está dentro do app bundle
    // macOS: Frameworks/Chromium Embedded Framework.framework
    // O Electron expõe o execPath que pode ser usado
    return app.getPath('exe')
  }
  // Em dev: usa o Chromium do Electron instalado em node_modules
  // electron/dist/Electron.app/Contents/MacOS/Electron (macOS)
  return require('electron').app.getPath('exe')
}

// Alternativa mais segura: usar BrowserWindow.webContents.printToPDF()
// para PDF e capturePage() para screenshots, sem Puppeteer.
// Avaliar na implementação qual caminho é mais estável.
```

**Fallback plan**: Se Puppeteer + Electron for muito instável, usar as APIs nativas do Electron (`webContents.printToPDF()`, `webContents.capturePage()`) com uma BrowserWindow hidden renderizando o HTML. Mais limitado (sem seletor por div), mas zero dependência extra. Story/carrossel exigiria renderizar cada seção em BrowserWindow separada.

### Export Dimensions (Story/Carrossel)

- **Story (1080×1920)**: cada seção é renderizada em viewport fixo de 1080×1920. O CSS usa `height: 1920px; overflow: hidden` e `display: flex; flex-direction: column` com `justify-content: space-between` pra distribuir header + grid + espaço. Se conteúdo exceder, scale automático via `transform: scale()` no container.
- **Carrossel (1080×1080)**: cada página renderizada quadrada. Mesmo approach de viewport fixo.
- **PDF**: viewport customizável (A4 ou tamanho livre), Puppeteer gera multi-page.

## Guardrails

- Match sempre por código primeiro (exato), nunca por nome sozinho
- Fallback sempre sinalizado (nunca silencioso)
- snake_case ponta a ponta
- Histórico completo (nunca deletar jornal, só arquivar)
- Não usar canvas (CSS resolve)
- Não over-engineer template engine (layout é fixo)
- IA assiste, não decide layout
