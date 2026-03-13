import { describe, it, expect } from 'vitest'
import { buildFullHtml, buildSectionHtml, buildPageHtml } from '../../src/main/export/html-builder'
import type { JournalData } from '../../src/main/export/html-builder'
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

// === Test Fixtures ===

const makeLoja = (): Loja => ({
  loja_id: 1,
  nome: 'Sup Fernandes',
  endereco: 'Rua Teste 123',
  telefone: '(11) 1234-5678',
  horario_func: 'SEG-SAB 8h-19h',
  logo_path: null
})

const makeTemplate = (overrides: Partial<TemplateSecao> = {}): TemplateSecao => ({
  secao_id: 1,
  slug: 'acougue',
  nome_display: 'Açougue do Fernandes',
  posicao: 1,
  pagina: 1,
  lado: 'full',
  grid_cols: 3,
  grid_rows: 3,
  bg_path: null,
  header_path: null,
  cor_tema: '#8B0000',
  ...overrides
})

const makeProduto = (overrides: Partial<Produto> = {}): Produto => ({
  produto_id: 1,
  codigo: '515',
  nome: 'CERVEJA CRYSTAL 350ML LATA',
  nome_card: null,
  unidade: 'UN',
  categoria: 'bebidas',
  ativo: true,
  criado_em: '2026-03-01',
  atualizado_em: '2026-03-01',
  ...overrides
})

const makeImagem = (overrides: Partial<ProdutoImagem> = {}): ProdutoImagem => ({
  imagem_id: 1,
  produto_id: 1,
  arquivo_path: 'images/products/515/crystal.png',
  variacao: null,
  is_default: true,
  criado_em: '2026-03-01',
  ...overrides
})

const makeItem = (overrides: Partial<JornalItem> = {}): JornalItem => ({
  item_id: 1,
  jornal_id: 1,
  jornal_secao_id: 1,
  posicao: 1,
  produto_id: 1,
  preco_oferta: 2.49,
  preco_clube: 2.39,
  unidade_display: null,
  imagem_id: 1,
  is_fallback: false,
  img_scale: 1.0,
  img_offset_x: 0,
  img_offset_y: 0,
  imgs_compostas: null,
  criado_em: '2026-03-01',
  ...overrides
})

const makeSecao = (overrides: Partial<JornalSecao> = {}): JornalSecao => ({
  jornal_secao_id: 1,
  jornal_id: 1,
  pagina_id: 1,
  template_secao_id: 1,
  posicao: 1,
  lado: 'full',
  grid_cols: 3,
  grid_rows: 3,
  nome_custom: null,
  bg_custom: null,
  header_custom: null,
  ...overrides
})

const makePagina = (overrides: Partial<JornalPagina> = {}): JornalPagina => ({
  pagina_id: 1,
  jornal_id: 1,
  numero: 1,
  layout: 'full',
  banner_path: null,
  ...overrides
})

const makeJornal = (overrides: Partial<Jornal> = {}): Jornal => ({
  jornal_id: 1,
  titulo: 'Jornal Teste',
  tipo: 'semanal',
  data_inicio: '2026-03-10',
  data_fim: '2026-03-16',
  banner_path: null,
  status: 'rascunho',
  criado_em: '2026-03-01',
  atualizado_em: '2026-03-01',
  ...overrides
})

function buildData(overrides: Partial<JournalData> = {}): JournalData {
  return {
    jornal: makeJornal(),
    paginas: [makePagina()],
    secoes: [makeSecao()],
    itens: [makeItem(), makeItem({ item_id: 2, posicao: 2, produto_id: 2, imagem_id: null, is_fallback: true, preco_oferta: 45.98, preco_clube: 44.98 })],
    produtos: [
      makeProduto(),
      makeProduto({ produto_id: 2, codigo: '5920', nome: 'COXÃO MOLE', unidade: 'KG' })
    ],
    imagens: [makeImagem()],
    templates: [makeTemplate()],
    loja: makeLoja(),
    ...overrides
  }
}

// === Tests ===

describe('html-builder', () => {
  const DATA_DIR = '/fake/data'

  describe('buildFullHtml', () => {
    it('should generate valid HTML document', () => {
      const html = buildFullHtml(buildData(), DATA_DIR)
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html>')
      expect(html).toContain('</html>')
      expect(html).toContain('<body>')
      expect(html).toContain('</body>')
      expect(html).toContain('width: 1080px')
    })

    it('should render section with template name and color', () => {
      const html = buildFullHtml(buildData(), DATA_DIR)
      expect(html).toContain('Açougue do Fernandes')
      expect(html).toContain('#8B0000')
    })

    it('should use nome_custom over template name when set', () => {
      const data = buildData({
        secoes: [makeSecao({ nome_custom: 'Promoção Especial' })]
      })
      const html = buildFullHtml(data, DATA_DIR)
      expect(html).toContain('Promoção Especial')
    })
  })

  describe('card rendering', () => {
    it('should render card with image when available', () => {
      const html = buildFullHtml(buildData(), DATA_DIR)
      expect(html).toContain(`file://${DATA_DIR}/images/products/515/crystal.png`)
      expect(html).toContain('CERVEJA CRYSTAL')
    })

    it('should render placeholder when no image', () => {
      const html = buildFullHtml(buildData(), DATA_DIR)
      expect(html).toContain('Sem imagem') // second item has no image
    })

    it('should format prices in Brazilian format (comma)', () => {
      const html = buildFullHtml(buildData(), DATA_DIR)
      expect(html).toContain('R$ 2,49') // preco_oferta
      expect(html).toContain('R$ 2,39') // preco_clube
      expect(html).toContain('R$ 45,98')
    })

    it('should show club price badge when different from oferta', () => {
      const html = buildFullHtml(buildData(), DATA_DIR)
      expect(html).toContain('CLUBE')
      expect(html).toContain('price-clube')
    })

    it('should NOT show club badge when prices are equal', () => {
      const data = buildData({
        itens: [makeItem({ preco_oferta: 10.0, preco_clube: 10.0 })]
      })
      const html = buildFullHtml(data, DATA_DIR)
      // There should be no CLUBE badge for this item
      expect(html).not.toContain('CLUBE')
    })

    it('should use nome_card when available', () => {
      const data = buildData({
        produtos: [makeProduto({ nome_card: 'Crystal Lata' })]
      })
      const html = buildFullHtml(data, DATA_DIR)
      expect(html).toContain('Crystal Lata')
    })

    it('should apply img_scale transform', () => {
      const data = buildData({
        itens: [makeItem({ img_scale: 1.5 })]
      })
      const html = buildFullHtml(data, DATA_DIR)
      expect(html).toContain('scale(1.5)')
    })
  })

  describe('page layouts', () => {
    it('should add page-dupla class for dupla layout', () => {
      const data = buildData({
        paginas: [makePagina({ layout: 'dupla' })]
      })
      const html = buildFullHtml(data, DATA_DIR)
      expect(html).toContain('page-dupla')
    })

    it('should NOT add page-dupla class for full layout', () => {
      const data = buildData({
        paginas: [makePagina({ layout: 'full' })]
      })
      const html = buildFullHtml(data, DATA_DIR)
      expect(html).not.toContain('page page-dupla')
    })

    it('should set data-export attribute on pages', () => {
      const html = buildFullHtml(buildData(), DATA_DIR)
      expect(html).toContain('data-export="pagina-1"')
    })

    it('should set data-export attribute on sections', () => {
      const html = buildFullHtml(buildData(), DATA_DIR)
      expect(html).toContain('data-export="secao-acougue"')
    })
  })

  describe('buildPageHtml', () => {
    it('should render standalone page with fixed dimensions', () => {
      const data = buildData()
      const html = buildPageHtml(data, data.paginas[0], DATA_DIR, { width: 1080, height: 1920 })
      expect(html).toContain('width: 1080px')
      expect(html).toContain('height: 1920px')
    })
  })

  describe('buildSectionHtml', () => {
    it('should render standalone section with fixed dimensions', () => {
      const data = buildData()
      const html = buildSectionHtml(data, data.secoes[0], DATA_DIR, { width: 1080, height: 1920 })
      expect(html).toContain('width: 1080px')
      expect(html).toContain('height: 1920px')
      expect(html).toContain('Açougue do Fernandes')
    })
  })

  describe('grid', () => {
    it('should respect grid_cols from section', () => {
      const data = buildData({
        secoes: [makeSecao({ grid_cols: 2 })]
      })
      const html = buildFullHtml(data, DATA_DIR)
      expect(html).toContain('grid-template-columns: repeat(2, 1fr)')
    })

    it('should cap grid_cols at 3', () => {
      const data = buildData({
        secoes: [makeSecao({ grid_cols: 5 })]
      })
      const html = buildFullHtml(data, DATA_DIR)
      expect(html).toContain('grid-template-columns: repeat(3, 1fr)')
    })
  })
})
