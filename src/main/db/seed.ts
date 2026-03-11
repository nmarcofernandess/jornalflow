import { execute, queryOne } from './query'
import { SECOES_DEFAULT } from '../../shared/constants'

export async function seed(): Promise<void> {
  // Loja default
  await execute(`
    INSERT INTO lojas (loja_id, nome, endereco, telefone, horario_func)
    VALUES (1, 'Sup Fernandes', 'R. Américo de Araújo Pires, 533 - Luis Antônio - SP',
            '(16) 3983-1144 / (16) 99741-2979',
            'SEG A SÁB: 8:00 - 19:00 | DOM: 8:00 - 12:00')
    ON CONFLICT (loja_id) DO NOTHING
  `)

  // Template sections + aliases
  for (const secao of SECOES_DEFAULT) {
    await execute(`
      INSERT INTO template_secoes (slug, nome_display, posicao, pagina, lado, grid_cols, grid_rows, cor_tema)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (slug) DO NOTHING
    `, [secao.slug, secao.nome_display, secao.posicao, secao.pagina,
        secao.lado, secao.grid_cols, secao.grid_rows, secao.cor_tema])

    const inserted = await queryOne<{ secao_id: number }>(
      'SELECT secao_id FROM template_secoes WHERE slug = $1', [secao.slug]
    )
    if (!inserted) continue

    for (const alias of secao.aliases) {
      await execute(`
        INSERT INTO secao_aliases (secao_id, alias)
        VALUES ($1, $2)
        ON CONFLICT (alias) DO NOTHING
      `, [inserted.secao_id, alias])
    }
  }
}
