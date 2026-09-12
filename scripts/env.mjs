import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
export function loadEnv(mode = 'development') {
  for (const path of [`.env.${mode}.local`, `.env.${mode}`]) {
    if (existsSync(path))
      for (const [key, value] of Object.entries(
        parseEnv(readFileSync(path, 'utf8'))
      )) {
        if (process.env[key] === undefined) process.env[key] = value
      }
  }
}
export function modeArg() {
  return process.argv[process.argv.indexOf('--mode') + 1] === 'production'
    ? 'production'
    : 'development'
}
