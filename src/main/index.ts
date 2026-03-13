import { app, shell, BrowserWindow, protocol } from 'electron'
import { join, resolve } from 'path'
import * as path from 'path'
import { readFileSync, existsSync } from 'fs'
import * as fsPromises from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMain } from '@egoist/tipc/main'
import { router } from './tipc'
import { ensureDataDirs } from './db/database'
import { getDb } from './db/database'
import { applyMigrations } from './db/schema'
import { seed } from './db/seed'
import { queryOne } from './db/query'
import icon from '../../resources/icon.png?asset'

// MIME types for images
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff'
}

// Register custom protocol BEFORE app.ready — called exactly once
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'jf-img',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      corsEnabled: true,
      supportFetchAPI: true
    }
  }
])

// Load .env.local into process.env (API keys etc — never committed to git)
function loadEnvLocal(): void {
  const envPath = resolve(app.getAppPath(), '../../.env.local')
  const devPath = resolve(process.cwd(), '.env.local')
  const filePath = existsSync(envPath) ? envPath : existsSync(devPath) ? devPath : null
  if (!filePath) return
  const lines = readFileSync(filePath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    process.env[key] = val
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register tipc IPC handlers
  registerIpcMain(router)

  // Handle jf-img:// protocol — reads files directly, bypasses Chromium net stack
  protocol.handle('jf-img', async (request) => {
    try {
      const url = new URL(request.url)
      let filePath = decodeURIComponent(url.pathname)

      if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(app.getAppPath(), filePath)
      }
      filePath = path.normalize(filePath)

      const data = await fsPromises.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(data.length),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    } catch (err: any) {
      return new Response('Not found', { status: 404 })
    }
  })

  // Load .env.local (API keys — never in git)
  loadEnvLocal()

  // Initialize data directories and database
  await ensureDataDirs()
  await getDb()
  await applyMigrations()
  await seed()

  // Seed knowledge base (idempotente — pula se ja existe)
  const { seedKnowledge } = await import('./db/seed-knowledge')
  await seedKnowledge().catch(err => console.warn('[boot] seedKnowledge falhou:', err.message))

  // Log active IA provider from DB config (configuracao_ia table, created by migration v3)
  const iaConfig = await queryOne<{ provider: string; modelo: string }>(
    'SELECT provider, modelo FROM configuracao_ia LIMIT 1',
    []
  )
  console.log(
    '[boot] IA provider:',
    iaConfig ? `${iaConfig.provider} (${iaConfig.modelo})` : 'nao configurado'
  )

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
