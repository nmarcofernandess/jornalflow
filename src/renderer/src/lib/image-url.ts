import { useState, useEffect } from 'react'
import { client } from '@renderer/servicos/client'

let cachedDataDir: string | null = null

export function useDataDir(): string {
  const [dir, setDir] = useState(cachedDataDir ?? '')

  useEffect(() => {
    if (cachedDataDir) return
    client['config.data_dir']().then((r) => {
      cachedDataDir = r.path
      setDir(r.path)
    })
  }, [])

  return dir
}

// Encode each path segment individually — preserves slashes, encodes spaces/accents/commas
function encodePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function imageUrl(dataDir: string, filePath: string | null | undefined): string | undefined {
  if (!filePath) return undefined
  // Absolute paths (playground) use directly, relative paths (products) prefix with dataDir
  const fullPath = filePath.startsWith('/') ? filePath : dataDir ? `${dataDir}/${filePath}` : null
  if (!fullPath) return undefined
  // standard:true scheme needs scheme://host/path — use "local" as dummy host
  return 'jf-img://local' + encodePath(fullPath)
}
