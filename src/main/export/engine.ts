import { BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs/promises'

export async function renderToImage(
  html: string,
  width: number,
  height: number,
  outputPath: string
): Promise<void> {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: { offscreen: true }
  })

  const tmpFile = path.join(app.getPath('temp'), `jf-export-${Date.now()}.html`)
  await fs.writeFile(tmpFile, html, 'utf-8')
  await win.loadFile(tmpFile)

  // Wait for content to be ready
  await win.webContents.executeJavaScript(
    'new Promise(r => { if (document.readyState === "complete") r(); else window.onload = r; })'
  )

  const image = await win.webContents.capturePage()
  await fs.writeFile(outputPath, image.toPNG())
  win.destroy()
  await fs.unlink(tmpFile).catch(() => {})
}

export async function renderToPdf(html: string, outputPath: string): Promise<void> {
  const win = new BrowserWindow({ width: 1080, height: 1920, show: false })

  const tmpFile = path.join(app.getPath('temp'), `jf-export-${Date.now()}.html`)
  await fs.writeFile(tmpFile, html, 'utf-8')
  await win.loadFile(tmpFile)

  await win.webContents.executeJavaScript(
    'new Promise(r => { if (document.readyState === "complete") r(); else window.onload = r; })'
  )

  const pdfData = await win.webContents.printToPDF({ printBackground: true })
  await fs.writeFile(outputPath, pdfData)
  win.destroy()
  await fs.unlink(tmpFile).catch(() => {})
}
