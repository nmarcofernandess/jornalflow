import type {
  Jornal,
  JornalPagina,
  JornalSecao,
  JornalItem,
  Produto,
  ProdutoImagem,
  TemplateSecao,
  Loja
} from '../../shared/types'

export interface JournalData {
  jornal: Jornal
  paginas: JornalPagina[]
  secoes: JornalSecao[]
  itens: JornalItem[]
  produtos: Produto[]
  imagens: ProdutoImagem[]
  templates: TemplateSecao[]
  loja: Loja | null
}

function formatPrice(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

function getImagePath(
  item: JornalItem,
  imagens: ProdutoImagem[],
  dataDir: string
): string | null {
  if (item.imagem_id) {
    const img = imagens.find((i) => i.imagem_id === item.imagem_id)
    if (img) return `file://${dataDir}/${img.arquivo_path}`
  }
  return null
}

export function buildFullHtml(data: JournalData, dataDir: string): string {
  const pagesHtml = data.paginas
    .sort((a, b) => a.numero - b.numero)
    .map((pagina) => {
      const pageSecoes = data.secoes.filter((s) => s.pagina_id === pagina.pagina_id)
      return buildPageContent(pagina, pageSecoes, data, dataDir)
    })
    .join('')

  return wrapHtml(pagesHtml, 1080, null)
}

export function buildSectionHtml(
  data: JournalData,
  secao: JornalSecao,
  dataDir: string,
  dims: { width: number; height: number }
): string {
  const template = data.templates.find((t) => t.secao_id === secao.template_secao_id)
  const items = data.itens
    .filter((i) => i.jornal_secao_id === secao.jornal_secao_id)
    .sort((a, b) => a.posicao - b.posicao)
  const content = buildSectionContent(secao, template || null, items, data, dataDir)
  return wrapHtml(content, dims.width, dims.height)
}

export function buildPageHtml(
  data: JournalData,
  pagina: JornalPagina,
  dataDir: string,
  dims: { width: number; height: number }
): string {
  const pageSecoes = data.secoes.filter((s) => s.pagina_id === pagina.pagina_id)
  const content = buildPageContent(pagina, pageSecoes, data, dataDir)
  return wrapHtml(content, dims.width, dims.height)
}

function wrapHtml(bodyContent: string, width: number, height: number | null): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${width}px;
    ${height ? `height: ${height}px;` : ''}
    font-family: Arial, sans-serif;
    background: white;
    overflow: hidden;
  }
  .page { width: 100%; page-break-after: always; }
  .page-dupla { display: flex; }
  .page-dupla > .secao { width: 50%; }
  .secao { padding: 8px; }
  .secao-header {
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    padding: 8px 0;
    color: white;
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .grid { display: grid; gap: 6px; }
  .card {
    border: 1px solid #eee;
    border-radius: 6px;
    overflow: hidden;
    background: white;
  }
  .card-img {
    width: 100%;
    aspect-ratio: 4/3;
    object-fit: cover;
    display: block;
  }
  .card-img-placeholder {
    width: 100%;
    aspect-ratio: 4/3;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 12px;
  }
  .card-name {
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 4px 6px;
    line-height: 1.2;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .card-price {
    text-align: center;
    padding: 2px 6px 6px;
  }
  .price-main {
    font-size: 16px;
    font-weight: 800;
    color: #dc2626;
  }
  .price-unit {
    font-size: 9px;
    color: #666;
  }
  .price-clube {
    display: inline-block;
    background: #2563eb;
    color: white;
    font-size: 8px;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 3px;
    margin-top: 2px;
  }
  .dates-bar {
    text-align: center;
    font-size: 10px;
    color: #666;
    padding: 4px;
    background: #f8f8f8;
  }
  .footer {
    text-align: center;
    font-size: 9px;
    color: #666;
    padding: 6px;
    border-top: 1px solid #eee;
  }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`
}

function buildPageContent(
  pagina: JornalPagina,
  secoes: JornalSecao[],
  data: JournalData,
  dataDir: string
): string {
  const sortedSecoes = secoes.sort((a, b) => a.posicao - b.posicao)
  const isDouble = pagina.layout === 'dupla'
  const secoesHtml = sortedSecoes
    .map((s) => {
      const template = data.templates.find((t) => t.secao_id === s.template_secao_id)
      const items = data.itens
        .filter((i) => i.jornal_secao_id === s.jornal_secao_id)
        .sort((a, b) => a.posicao - b.posicao)
      return buildSectionContent(s, template || null, items, data, dataDir)
    })
    .join('')

  return `<div class="page ${isDouble ? 'page-dupla' : ''}" data-export="pagina-${pagina.numero}">${secoesHtml}</div>`
}

function buildSectionContent(
  secao: JornalSecao,
  template: TemplateSecao | null,
  items: JornalItem[],
  data: JournalData,
  dataDir: string
): string {
  const name = secao.nome_custom || template?.nome_display || 'Seção'
  const color = template?.cor_tema || '#333'
  const cols = Math.min(secao.grid_cols, 3)

  const cardsHtml = items
    .map((item) => {
      const produto = data.produtos.find((p) => p.produto_id === item.produto_id)
      const imgPath = getImagePath(item, data.imagens, dataDir)
      return buildCardHtml(item, produto || null, imgPath)
    })
    .join('')

  return `
    <div class="secao" data-export="secao-${template?.slug || secao.jornal_secao_id}">
      <div class="secao-header" style="background-color: ${color}">${name}</div>
      <div class="grid" style="grid-template-columns: repeat(${cols}, 1fr)">
        ${cardsHtml}
      </div>
    </div>`
}

function buildCardHtml(
  item: JornalItem,
  produto: Produto | null,
  imgPath: string | null
): string {
  const name = produto?.nome_card || produto?.nome || 'Produto'
  const unit = item.unidade_display || produto?.unidade || 'UN'

  const imgHtml = imgPath
    ? `<img class="card-img" src="${imgPath}" alt="${name}" style="transform: scale(${item.img_scale})">`
    : `<div class="card-img-placeholder">Sem imagem</div>`

  const clubeHtml =
    item.preco_clube !== item.preco_oferta
      ? `<div class="price-clube">CLUBE R$ ${formatPrice(item.preco_clube)}</div>`
      : ''

  return `
    <div class="card">
      ${imgHtml}
      <div class="card-name">${name}</div>
      <div class="card-price">
        <span class="price-main">R$ ${formatPrice(item.preco_oferta)}</span>
        <span class="price-unit">${unit}</span>
        ${clubeHtml}
      </div>
    </div>`
}
