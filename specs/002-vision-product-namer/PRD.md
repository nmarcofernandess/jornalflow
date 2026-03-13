# PRD: Vision Product Namer

> **Workflow:** standard
> **Criado em:** 2026-03-13T02:30:00
> **Fonte:** inline + conversa
> **Budget:** medium

---

## Visao Geral

Implementar Vision Product Namer no JornalFlow — analise de imagens de produtos via IA (Gemini Flash) para sugerir/validar nomes. Port do vision.ts do InstaFlow adaptado para dominio de supermercado.

## Componentes

1. **vision.ts** no main process — `analisarProdutoImagem()` envia foto pro Gemini, recebe `{nome_sugerido, nome_card, marca, peso, categoria, confianca}`
2. **batch-vision.ts** — processa slot de ~30 imagens sequencialmente, 1 por 1, com progresso via IPC events
3. **IPC handlers** — analise individual e batch (com progress events)
4. **IA tool** `analisar_imagem_produto` para o chat — padrao 3-status (toolResult helper ja existe em tools.ts)
5. **Frontend** — tela de revisao com grid de thumbnails: [FOTO] [Nome atual] [Sugestao IA] [Aceitar/Editar/Rejeitar] com batch update

## Referencias de Codigo

- `~/instaflow/src/main/ia/vision.ts` — padrao de analise de imagem (analisarImagem, analisarEPersistir)
- `~/instaflow/src/main/ia/config.ts` — provider config multi-provider
- `src/main/import/batch-images.ts` — iteracao de pasta existente no JornalFlow
- `src/main/ia/cliente.ts` — ja suporta envio de imagens pro Gemini (Uint8Array + mediaType)
- `src/main/ia/config.ts` — config multi-provider ja implementada (Gemini + OpenRouter)

## Especificacoes Tecnicas

### Prompt de Analise (dominio supermercado)
O prompt deve instruir a IA a:
- Ler rotulo/embalagem do produto na foto
- Identificar: marca, nome do produto, peso/volume, unidade
- Gerar nome completo padrao supermercado (ex: "CERVEJA CRYSTAL LATA 350ML")
- Gerar nome_card curto para card do jornal (ex: "CRYSTAL 350ML")
- Sugerir categoria (carnes, hortifruti, mercearia, padaria, higiene, etc)
- Retornar confianca de 0-100

### Output Esperado da Analise
```typescript
interface AnaliseVisionProduto {
  nome_sugerido: string     // Nome completo padrao supermercado
  nome_card: string         // Nome curto pro card
  marca: string             // Marca identificada
  peso: string              // Peso/volume (ex: "350ml", "5kg", "1L")
  categoria: string         // Categoria sugerida
  confianca: number         // 0-100
}
```

### Batch Processing
- Slot de ~30 imagens (configuravel)
- Sequencial, 1 por 1 (evitar rate limit)
- Progress events via IPC: `{current, total, filename, resultado?}`
- Graceful: se 1 falha, continua com as demais

### Frontend — Tela de Revisao
- Grid de cards com thumbnail da imagem
- Mostra: [Imagem] [Nome Atual do Produto] [Sugestao IA] [Confianca]
- Acoes por item: Aceitar (aplica sugestao), Editar (abre input), Rejeitar (ignora)
- Acao em batch: "Aceitar Todos com Confianca > 80%"
- Ao aceitar: chama atualizar_produto com nome e nome_card sugeridos

### Modelo
- Default: usar modelo configurado no ia_config (Gemini Flash via config existente)
- Nao precisa de modelo offline por enquanto — o Gemini Flash e rapido e barato

## Criterios de Aceitacao

1. Enviar 1 foto de produto e receber sugestao de nome estruturada
2. Processar batch de 30 fotos com progress bar
3. Tela de revisao mostrando sugestoes lado a lado
4. Aceitar/rejeitar sugestoes com batch update
5. Tool no chat IA funcionando com 3-status
6. Graceful degradation se API falha (nunca crash)
