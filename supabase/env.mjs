import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export function resolveMode() {
  const modeArgumentIndex = process.argv.findIndex(arg => arg === '--mode')

  if (modeArgumentIndex >= 0) {
    return process.argv[modeArgumentIndex + 1]?.trim() || 'development'
  }

  return (
    process.env.SUPABASE_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    'development'
  )
}

export function loadLocalEnvFiles(mode) {
  const envFileNames = [
    '.env',
    '.env.local',
    `.env.${mode}`,
    `.env.${mode}.local`
  ]

  for (const fileName of envFileNames) {
    const filePath = path.resolve(process.cwd(), fileName)

    if (!fs.existsSync(filePath)) {
      continue
    }

    const fileContent = fs.readFileSync(filePath, 'utf8')

    for (const rawLine of fileContent.split(/\r?\n/u)) {
      const line = rawLine.trim()

      if (!line || line.startsWith('#')) {
        continue
      }

      const separatorIndex = line.indexOf('=')

      if (separatorIndex < 1) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()

      if (!key || process.env[key]) {
        continue
      }

      let value = line.slice(separatorIndex + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  }
}
