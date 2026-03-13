import { queryOne } from './query'
import { ingestKnowledge } from '../knowledge/ingest'

/**
 * Conteudo seed embutido como constantes.
 *
 * Os arquivos .md em src/main/knowledge/seeds/ sao a fonte de verdade legivel,
 * mas electron-vite bundla o main process em chunks — .md files nao sao copiados
 * pro output. Por isso o conteudo e inline aqui.
 */
interface SeedEntry {
  titulo: string
  conteudo: string
  importance: 'high' | 'low'
}

const SEEDS: SeedEntry[] = [
  {
    titulo: 'Secoes do Jornal de Ofertas',
    importance: 'high',
    conteudo: `<!-- quando_usar: Quando o usuario perguntar sobre secoes do jornal, categorias de produtos, ou organizacao do layout -->
# Secoes do Jornal de Ofertas

O jornal do Supermercado Fernandes tem 5 secoes principais:

## Acougue
Carnes bovinas, suinas, aves e embutidos. Produtos como picanha, alcatra, frango inteiro, linguica.
Aliases: acougue, carnes, frios

## Horti Fruti
Frutas, verduras, legumes e hortigranjeiros. Produtos como banana, tomate, alface, batata.
Aliases: horti, hortifruti, frutas, verduras, frutaria

## Mercearia
Produtos de prateleira: arroz, feijao, oleo, acucar, cafe, biscoitos, enlatados, temperos.
Aliases: mercearia, secos, prateleira

## Padaria
Paes, bolos, salgados e confeitaria. Produtos como pao frances, bolo de chocolate, croissant.
Aliases: padaria, paes, confeitaria

## Casa & Higiene
Produtos de limpeza e higiene pessoal: detergente, sabao em po, shampoo, papel higienico.
Aliases: casa, higiene, limpeza, casa_higiene`,
  },
  {
    titulo: 'Regras de Layout do Jornal',
    importance: 'high',
    conteudo: `<!-- quando_usar: Quando o usuario perguntar sobre layout do jornal, posicoes, grid, paginas ou organizacao visual -->
# Regras de Layout do Jornal

## Estrutura de Paginas
- Cada jornal tem multiplas paginas
- Cada pagina pode ter frente e verso (lados)
- Cada lado contem secoes posicionadas em grid

## Grid System
- Cada secao tem grid_cols (colunas) e grid_rows (linhas)
- Padrao: 3x3 = 9 posicoes por secao
- Cada posicao recebe 1 produto (card)

## Template de Secoes
- template_secoes define a estrutura padrao
- Cada secao tem: slug, nome_display, posicao, pagina, lado
- Secoes podem ter background customizado (bg_path) e header (header_path)

## Cards de Produto
- Cada card mostra: imagem, nome, preco oferta, preco clube
- nome_card e a versao curta do nome para caber no card
- Imagens podem ter escala (img_scale) e offset (img_offset_x, img_offset_y)
- Imagens compostas (imgs_compostas) permitem combinar multiplas imagens`,
  },
  {
    titulo: 'Fluxo de Importacao de Planilha',
    importance: 'high',
    conteudo: `<!-- quando_usar: Quando o usuario perguntar sobre importacao de planilha, processo de criacao de jornal, ou matching de produtos -->
# Fluxo de Importacao de Planilha

## Processo
1. Usuario faz upload de planilha XLS/XLSX com ~45 produtos
2. Parser (xls-parser) extrai: nome, codigo, preco oferta, preco clube, secao
3. Matching automatico busca produtos no banco por codigo ou nome fuzzy
4. Para cada produto matched: busca imagem default (is_default=true)
5. Produtos nao encontrados ficam como is_fallback=true (sem imagem real)
6. Jornal e criado com secoes e itens posicionados automaticamente

## Tabela importacoes
- Registra cada importacao: arquivo_nome, total_itens, matched, fallbacks, nao_encontrados
- Status permite rastrear qualidade do matching

## Problemas Comuns
- Produtos com nome diferente na planilha vs banco -> fallback
- Produtos sem imagem no banco -> card sem foto
- Secao nao reconhecida -> produto fica sem secao
- Preco zero -> pode indicar erro na planilha

## Revisao
- Apos importacao, IA pode revisar (tool revisar_planilha)
- Itens com is_fallback=true precisam de atencao
- Trocar item (trocar_item) substitui produto de uma posicao`,
  },
  {
    titulo: 'Padroes de Naming e Formatacao',
    importance: 'low',
    conteudo: `<!-- quando_usar: Quando o usuario perguntar sobre padroes de nome de produto, codigos, unidades ou formatacao -->
# Padroes de Naming e Formatacao

## Codigos de Produto
- Numericos sequenciais ou codigos internos do supermercado
- Unique constraint no banco (nao pode repetir)

## Nomes de Produto
- Nome completo: "Arroz Tipo 1 Tio Joao 5kg"
- nome_card (curto): "Arroz Tio Joao 5kg" (para caber no card)
- Padrao: [Produto] [Marca] [Quantidade/Peso]

## Unidades
- UN (unidade), KG (quilograma), PCT (pacote), CX (caixa), LT (litro)
- FD (fardo), DZ (duzia), BD (bandeja)

## Categorias
- Mapeiam para secoes: "carnes" -> Acougue, "frutas" -> Horti Fruti
- Algumas categorias sao transversais

## Precos
- Formato brasileiro: R$ X,XX
- preco_oferta: preco promocional do jornal
- preco_clube: preco para membros do clube de descontos
- Ambos em DECIMAL(10,2) no banco`,
  },
]

/**
 * Ingesta seed knowledge files. Idempotente — pula se ja existe.
 * Chamado no boot em index.ts, apos applyMigrations.
 */
export async function seedKnowledge(): Promise<void> {
  // Graceful: se tabela nao existe, skip silenciosamente
  try {
    await queryOne('SELECT 1 FROM knowledge_sources LIMIT 1', [])
  } catch {
    console.log('[seed-knowledge] Tabela knowledge_sources nao existe ainda — pulando seed')
    return
  }

  for (const seed of SEEDS) {
    // Idempotente: pula se ja existe source com esse titulo
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM knowledge_sources WHERE titulo = $1',
      [seed.titulo]
    )
    if (existing) {
      continue
    }

    try {
      const result = await ingestKnowledge(
        seed.titulo,
        seed.conteudo,
        seed.importance,
        { tipo: 'sistema' }
      )
      console.log(`[seed-knowledge] Ingestado: ${seed.titulo} (${result.chunks_count} chunks)`)
    } catch (err) {
      console.warn(`[seed-knowledge] Falha ao ingestar "${seed.titulo}":`, (err as Error).message)
    }
  }
}
