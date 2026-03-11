import { describe, it, expect } from 'vitest'
import { parsePlanilha } from '../../src/main/import/parser'

const SAMPLE_TSV = `Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube
\t\t\t\t
\t\t\t\t
515\tCERVEJA CRYSTAL 350 ML LATA\t2,49\tACOUGUE\t2,39
5920\tCOXAO MOLE KG\t45,98\tACOUGUE\t44,98
\t\t\t\t
6536\tLARANJA PERA KG\t3,89\tHORTIFRUTI\t3,59`

describe('parsePlanilha', () => {
  it('should parse TSV with Brazilian decimal format', () => {
    const result = parsePlanilha(SAMPLE_TSV)
    expect(result.rows.length).toBe(3)
    expect(result.rows[0].codigo).toBe('515')
    expect(result.rows[0].preco_oferta).toBe(2.49)
    expect(result.rows[0].preco_clube).toBe(2.39)
    expect(result.rows[0].tipo_oferta).toBe('ACOUGUE')
  })

  it('should skip empty lines', () => {
    const result = parsePlanilha(SAMPLE_TSV)
    expect(result.rows.length).toBe(3)
  })

  it('should extract unit from description', () => {
    const result = parsePlanilha(SAMPLE_TSV)
    const coxao = result.rows.find(r => r.codigo === '5920')
    expect(coxao?.unidade_extraida).toBe('KG')
    const crystal = result.rows.find(r => r.codigo === '515')
    expect(crystal?.unidade_extraida).toBe('UN') // "350 ML" → UN
  })

  it('should auto-detect delimiter (CSV with semicolon)', () => {
    const csv = 'Produto;Descrição;Preço Oferta;Tipo Oferta;clube\n515;CERVEJA CRYSTAL;2,49;ACOUGUE;2,39'
    const result = parsePlanilha(csv)
    expect(result.rows[0].codigo).toBe('515')
  })

  it('should handle Latin-1 encoded text', () => {
    const tsv = 'Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube\n515\tCERVEJA CRYSTAL 350 ML LATA\t2,49\tACOUGUE\t2,39'
    const result = parsePlanilha(tsv)
    expect(result.rows[0].descricao).toContain('CERVEJA')
  })

  it('should report invalid lines in errors', () => {
    const bad = 'Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube\n\tSEM CODIGO\t2,49\tACOUGUE\t2,39'
    const result = parsePlanilha(bad)
    expect(result.rows.length).toBe(0)
    expect(result.errors.length).toBe(1)
  })

  it('should handle missing clube price (use oferta price)', () => {
    const tsv = 'Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube\n515\tCERVEJA\t2,49\tACOUGUE\t'
    const result = parsePlanilha(tsv)
    expect(result.rows[0].preco_clube).toBe(2.49)
  })

  it('should default unidade to UN when no pattern matches', () => {
    const tsv = 'Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube\n100\tARROZ INTEGRAL\t5,99\tMERCEARIA\t5,49'
    const result = parsePlanilha(tsv)
    expect(result.rows[0].unidade_extraida).toBe('UN')
  })
})
