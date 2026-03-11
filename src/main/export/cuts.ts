import { renderToImage, renderToPdf } from './engine'
import { buildFullHtml, buildSectionHtml, buildPageHtml } from './html-builder'
import { carregarJornal } from '../servicos/jornais'
import { getDataDir } from '../db/database'
import { EXPORT_DIMENSIONS } from '../../shared/constants'
import path from 'path'
import fs from 'fs/promises'

interface ExportResult {
  files: string[]
  outputDir: string
}

export async function exportAll(jornal_id: number): Promise<ExportResult> {
  const data = await carregarJornal(jornal_id)
  const dataDir = getDataDir()
  const outputDir = path.join(dataDir, 'exports', `jornal-${jornal_id}`)
  await fs.mkdir(outputDir, { recursive: true })

  const files: string[] = []

  // PDF full
  const fullHtml = buildFullHtml(data, dataDir)
  await renderToPdf(fullHtml, path.join(outputDir, 'jornal-completo.pdf'))
  files.push('jornal-completo.pdf')

  // PNG per page
  for (const pagina of data.paginas) {
    const dims =
      pagina.layout === 'full' ? EXPORT_DIMENSIONS.pagina_full : EXPORT_DIMENSIONS.pagina_dupla
    const pageHtml = buildPageHtml(data, pagina, dataDir, dims)
    await renderToImage(
      pageHtml,
      dims.width,
      dims.height,
      path.join(outputDir, `pagina-${pagina.numero}.png`)
    )
    files.push(`pagina-${pagina.numero}.png`)
  }

  // Story per section
  for (const secao of data.secoes) {
    const template = data.templates.find((t) => t.secao_id === secao.template_secao_id)
    const slug = template?.slug || `secao-${secao.jornal_secao_id}`
    const sectionHtml = buildSectionHtml(data, secao, dataDir, EXPORT_DIMENSIONS.story)
    await renderToImage(
      sectionHtml,
      EXPORT_DIMENSIONS.story.width,
      EXPORT_DIMENSIONS.story.height,
      path.join(outputDir, `story-${slug}.png`)
    )
    files.push(`story-${slug}.png`)
  }

  // Carrossel per page
  for (const pagina of data.paginas) {
    const pageHtml = buildPageHtml(data, pagina, dataDir, EXPORT_DIMENSIONS.carrossel)
    await renderToImage(
      pageHtml,
      EXPORT_DIMENSIONS.carrossel.width,
      EXPORT_DIMENSIONS.carrossel.height,
      path.join(outputDir, `carrossel-pagina-${pagina.numero}.png`)
    )
    files.push(`carrossel-pagina-${pagina.numero}.png`)
  }

  return { files, outputDir }
}
