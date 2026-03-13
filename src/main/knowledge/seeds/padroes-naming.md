<!-- quando_usar: Quando o usuario perguntar sobre padroes de nome de produto, codigos, unidades ou formatacao -->
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
- Ambos em DECIMAL(10,2) no banco
