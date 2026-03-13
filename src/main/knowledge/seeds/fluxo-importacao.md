<!-- quando_usar: Quando o usuario perguntar sobre importacao de planilha, processo de criacao de jornal, ou matching de produtos -->
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
- Trocar item (trocar_item) substitui produto de uma posicao
