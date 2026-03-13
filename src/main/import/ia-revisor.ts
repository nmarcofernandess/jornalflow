import { generateText } from 'ai'
import { getModel } from '../ia/config'
import type { PlanilhaRow } from '../../shared/types'
import { CATEGORIAS, SECOES_DEFAULT } from '../../shared/constants'
import { queryAll } from '../db/query'
import type { Produto } from '../../shared/types'

export interface RevisaoIA {
  rows_revisadas: PlanilhaRow[]
  sugestoes: Array<{
    linha: number
    campo: string
    original: string
    sugerido: string
    motivo: string
  }>
  categorias_sugeridas: Record<string, string> // codigo → categoria
  resumo: string
}

export async function revisarImportacaoComIA(rows: PlanilhaRow[]): Promise<RevisaoIA> {
  const model = getModel()

  // Get existing products for context
  const produtosExistentes = await queryAll<Produto>(
    'SELECT codigo, nome, unidade, categoria FROM produtos WHERE ativo = true ORDER BY nome LIMIT 200'
  )

  const categoriasDisponiveis = CATEGORIAS.join(', ')
  const secoesDisponiveis = SECOES_DEFAULT.map(s => `${s.aliases[0]} (${s.nome_display})`).join(', ')

  const prompt = `Você é um revisor de dados de planilha de ofertas de supermercado. Analise os dados importados e sugira correções.

## Contexto
- Supermercado Fernandes (Luis Antônio - SP)
- Categorias válidas: ${categoriasDisponiveis}
- Seções do jornal: ${secoesDisponiveis}

## Produtos já cadastrados no banco (${produtosExistentes.length} produtos):
${produtosExistentes.slice(0, 50).map(p => `- ${p.codigo}: ${p.nome} (${p.unidade}, ${p.categoria || 'sem categoria'})`).join('\n')}

## Dados importados (${rows.length} linhas):
${rows.map((r, i) => `${i + 1}. [${r.codigo}] ${r.descricao} | R$ ${r.preco_oferta.toFixed(2)} | Clube: R$ ${r.preco_clube.toFixed(2)} | tipo_oferta: ${r.tipo_oferta || 'N/A'} | unidade_extraida: ${r.unidade_extraida}`).join('\n')}

## Tarefas
1. Verifique se as descrições estão padronizadas (ex: "CRVJ CRYSTAL" → "CERVEJA CRYSTAL 350ML LATA")
2. Verifique se os preços fazem sentido (carne a R$ 0,50 está errado, arroz a R$ 150 está errado)
3. Verifique se as unidades extraídas estão corretas (KG para carnes, UN para unidades, etc.)
4. Verifique se as seções (tipo_oferta) estão corretas para o tipo de produto
5. Sugira categorias para produtos novos

## CAMPOS VÁLIDOS para sugestões
Use EXATAMENTE estes nomes de campo:
- "descricao" — nome/descrição do produto
- "preco_oferta" — preço de oferta
- "preco_clube" — preço do clube
- "tipo_oferta" — setor/seção do jornal (ACOUGUE, HORTIFRUTI, MERCEARIA, etc.)
- "unidade_extraida" — unidade de medida (KG, UN, etc.)
- "categoria" — categoria sugerida para produto novo (será usada no cadastro)

## Formato de resposta (JSON estrito)
Responda APENAS com JSON válido, sem markdown:
{
  "sugestoes": [
    {
      "linha": 1,
      "campo": "descricao",
      "original": "CRVJ CRYSTAL 350",
      "sugerido": "CERVEJA CRYSTAL 350ML LATA",
      "motivo": "Abreviação expandida"
    }
  ],
  "resumo": "Breve resumo das correções sugeridas"
}

Se não há sugestões, retorne: {"sugestoes": [], "resumo": "Dados OK, nenhuma correção necessária."}`

  const result = await generateText({
    model,
    messages: [{ role: 'user', content: prompt }]
  })

  // Parse IA response
  let parsed: { sugestoes: RevisaoIA['sugestoes']; resumo: string }
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonText = result.text.trim()
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonText = jsonMatch[1].trim()
    parsed = JSON.parse(jsonText)
  } catch {
    // If IA response isn't valid JSON, return no changes
    parsed = {
      sugestoes: [],
      resumo: `IA não retornou formato válido. Resposta: ${result.text.slice(0, 200)}`
    }
  }

  // Separate category suggestions (metadata for product creation) from row corrections
  const categorias_sugeridas: Record<string, string> = {}

  // Apply suggestions to create revised rows
  const rows_revisadas = rows.map((row, i) => {
    const rowSugestoes = parsed.sugestoes.filter(s => s.linha === i + 1)
    if (rowSugestoes.length === 0) return { ...row }

    const revised = { ...row }
    for (const sug of rowSugestoes) {
      switch (sug.campo) {
        case 'descricao':
          revised.descricao = sug.sugerido
          break
        case 'preco_oferta':
          revised.preco_oferta = parseFloat(sug.sugerido) || row.preco_oferta
          break
        case 'preco_clube':
          revised.preco_clube = parseFloat(sug.sugerido) || row.preco_clube
          break
        case 'tipo_oferta':
          revised.tipo_oferta = sug.sugerido
          break
        case 'unidade_extraida':
          revised.unidade_extraida = sug.sugerido
          break
        case 'categoria':
          categorias_sugeridas[row.codigo] = sug.sugerido
          break
      }
    }
    return revised
  })

  return {
    rows_revisadas,
    sugestoes: parsed.sugestoes.filter(s => s.campo !== 'categoria'),
    categorias_sugeridas,
    resumo: parsed.resumo
  }
}
