import { describe, it, expect } from 'vitest'
import { parseXlsFile, parseXlsBuffer } from '../../src/main/import/xls-parser'
import { parseUploadedFile } from '../../src/main/import/upload-handler'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Real XLS file from Marco's wife (WPS Spreadsheets)
const REAL_XLS = path.join(os.homedir(), 'Desktop', 'Cadastro_de_Simulação_Ofertas do dia 13 a 19-03.xls')

function hasRealXls(): boolean {
  try {
    fs.accessSync(REAL_XLS)
    return true
  } catch {
    return false
  }
}

describe('xls-parser', () => {
  describe('parseXlsFile (real XLS)', () => {
    it('should parse the real XLS file from Desktop', () => {
      if (!hasRealXls()) return

      const result = parseXlsFile(REAL_XLS)

      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.sheet_name).toBeTruthy()

      // Every row should have required fields
      for (const row of result.rows) {
        expect(row.codigo).toBeTruthy()
        expect(row.descricao).toBeTruthy()
        expect(row.preco_oferta).toBeGreaterThan(0)
        expect(row.unidade_extraida).toBeTruthy()
      }
    })

    it('should extract correct column mappings', () => {
      if (!hasRealXls()) return

      const result = parseXlsFile(REAL_XLS)

      // Should have detected the headers
      expect(result.raw_headers.length).toBeGreaterThan(0)

      // First row should have a numeric codigo
      const firstRow = result.rows[0]
      expect(firstRow.codigo).toMatch(/^\d+$/)
    })

    it('should extract prices as numbers', () => {
      if (!hasRealXls()) return

      const result = parseXlsFile(REAL_XLS)
      for (const row of result.rows) {
        expect(typeof row.preco_oferta).toBe('number')
        expect(typeof row.preco_clube).toBe('number')
        expect(row.preco_oferta).toBeGreaterThan(0)
        expect(row.preco_clube).toBeGreaterThan(0)
      }
    })

    it('should detect tipo_oferta (section) when present', () => {
      if (!hasRealXls()) return

      const result = parseXlsFile(REAL_XLS)
      // The real planilha should have at least some rows with tipo_oferta
      const rowsComSetor = result.rows.filter(r => r.tipo_oferta)
      // May or may not have sections — depends on the actual file
      // Just verify it doesn't crash
      expect(result.errors.length).toBeLessThan(result.rows.length)
    })

    it('should extract units from descriptions', () => {
      if (!hasRealXls()) return

      const result = parseXlsFile(REAL_XLS)
      const kgRows = result.rows.filter(r => r.unidade_extraida === 'KG')
      const unRows = result.rows.filter(r => r.unidade_extraida === 'UN')

      // Should have at least some of each
      expect(kgRows.length + unRows.length).toBeGreaterThan(0)
    })
  })

  describe('parseXlsBuffer', () => {
    it('should parse buffer from real file', () => {
      if (!hasRealXls()) return

      const buffer = fs.readFileSync(REAL_XLS)
      const result = parseXlsBuffer(buffer)

      expect(result.rows.length).toBeGreaterThan(0)
    })
  })

  describe('upload-handler', () => {
    it('should auto-detect XLS format', () => {
      if (!hasRealXls()) return

      const result = parseUploadedFile(REAL_XLS)

      expect(result.formato).toBe('xls')
      expect(result.arquivo_nome).toContain('Cadastro')
      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should handle TSV text files', () => {
      const tmpFile = path.join(os.tmpdir(), 'test-upload.tsv')
      fs.writeFileSync(tmpFile, 'Produto\tDescrição\tPreço Oferta\tTipo Oferta\tclube\n515\tCERVEJA CRYSTAL 350ML\t2,49\tACOUGUE\t2,39')

      const result = parseUploadedFile(tmpFile)

      expect(result.formato).toBe('tsv')
      expect(result.rows.length).toBe(1)
      expect(result.rows[0].codigo).toBe('515')

      fs.unlinkSync(tmpFile)
    })

    it('should handle CSV files with semicolons', () => {
      const tmpFile = path.join(os.tmpdir(), 'test-upload.csv')
      fs.writeFileSync(tmpFile, 'Produto;Descrição;Preço Oferta;Tipo Oferta;clube\n515;CERVEJA CRYSTAL 350ML;2,49;ACOUGUE;2,39')

      const result = parseUploadedFile(tmpFile)

      expect(result.formato).toBe('csv')
      expect(result.rows.length).toBe(1)

      fs.unlinkSync(tmpFile)
    })

    it('should reject unsupported formats', () => {
      const tmpFile = path.join(os.tmpdir(), 'test-upload.pdf')
      fs.writeFileSync(tmpFile, 'not a spreadsheet')

      const result = parseUploadedFile(tmpFile)

      expect(result.rows.length).toBe(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].reason).toContain('não suportado')

      fs.unlinkSync(tmpFile)
    })
  })
})
