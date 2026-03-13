<!-- quando_usar: Quando o usuario perguntar sobre layout do jornal, posicoes, grid, paginas ou organizacao visual -->
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
- Imagens compostas (imgs_compostas) permitem combinar multiplas imagens
