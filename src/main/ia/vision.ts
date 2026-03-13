import { generateText } from 'ai'
import { readFile } from 'fs/promises'
import type { LanguageModel } from 'ai'
import type { AnaliseVisionProduto } from '../../shared/types'

// ---------------------------------------------------------------------------
// VISION_PROMPT — prompt especifico para dominio de supermercado
// Exportado para uso em testes
// ---------------------------------------------------------------------------

export const VISION_PROMPT = `Voce e um especialista em produtos de supermercado. Analise a imagem da embalagem ou rotulo do produto e retorne um JSON com as seguintes informacoes:

- "nome_sugerido": nome completo padrao supermercado em MAIUSCULAS (ex: "CERVEJA CRYSTAL LATA 350ML", "OLEO DE SOJA SOYA 900ML", "ARROZ TIO JOAO TIPO 1 5KG")
- "nome_card": nome curto e impactante para o card do jornal promocional em MAIUSCULAS (ex: "CRYSTAL 350ML", "SOYA 900ML", "TIO JOAO 5KG") — max 30 caracteres
- "marca": marca ou fabricante identificado na embalagem (ex: "Crystal", "Soya", "Tio Joao")
- "peso": peso ou volume com unidade (ex: "350ml", "5kg", "1L", "200g") — apenas o valor, sem o nome do produto
- "categoria": categoria do produto — escolha uma de: carnes, hortifruti, mercearia, padaria, laticinios, bebidas, higiene, limpeza, congelados, frios, bazar, outro
- "confianca": numero de 0 a 100 indicando sua confianca na identificacao (100 = certeza absoluta, 0 = impossivel identificar)

Regras:
1. nome_sugerido deve seguir o padrao: CATEGORIA/TIPO + MARCA + VARIACAO + QUANTIDADE
2. nome_card deve ser o mais curto e memoravel possivel para um encarte de supermercado
3. Se nao conseguir identificar algum campo com certeza, use string vazia para texto ou 0 para confianca
4. Retorne APENAS o JSON valido, sem markdown, sem explicacoes, sem texto adicional

Exemplo de saida:
{"nome_sugerido":"CERVEJA CRYSTAL LATA 350ML","nome_card":"CRYSTAL 350ML","marca":"Crystal","peso":"350ml","categoria":"bebidas","confianca":95}`

// ---------------------------------------------------------------------------
// analisarProdutoImagem — analisa imagem de produto via Vision AI
// ---------------------------------------------------------------------------

/**
 * Analisa uma imagem de produto usando Vision AI e retorna sugestao de nome estruturada.
 *
 * @param filePath  - Caminho absoluto para o arquivo de imagem
 * @param createModel - Factory que cria o LanguageModel (de buildModelFactory)
 * @param modelo    - Identificador do modelo a usar
 * @returns AnaliseVisionProduto com nome, marca, peso, categoria e confianca
 */
export async function analisarProdutoImagem(
  filePath: string,
  createModel: (m: string) => LanguageModel,
  modelo: string
): Promise<AnaliseVisionProduto> {
  const imageBuffer = await readFile(filePath)
  const base64 = imageBuffer.toString('base64')

  const ext = filePath.toLowerCase()
  let mimeType: string
  if (ext.endsWith('.png')) {
    mimeType = 'image/png'
  } else if (ext.endsWith('.webp')) {
    mimeType = 'image/webp'
  } else {
    mimeType = 'image/jpeg'
  }

  const { text } = await generateText({
    model: createModel(modelo),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: `data:${mimeType};base64,${base64}` },
          { type: 'text', text: VISION_PROMPT }
        ]
      }
    ],
    maxTokens: 1000
  })

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as AnaliseVisionProduto
    return {
      nome_sugerido: typeof parsed.nome_sugerido === 'string' ? parsed.nome_sugerido : '',
      nome_card: typeof parsed.nome_card === 'string' ? parsed.nome_card : '',
      marca: typeof parsed.marca === 'string' ? parsed.marca : '',
      peso: typeof parsed.peso === 'string' ? parsed.peso : '',
      categoria: typeof parsed.categoria === 'string' ? parsed.categoria : '',
      confianca: typeof parsed.confianca === 'number' ? parsed.confianca : 0
    }
  } catch {
    return {
      nome_sugerido: '',
      nome_card: '',
      marca: '',
      peso: '',
      categoria: '',
      confianca: 0
    }
  }
}
