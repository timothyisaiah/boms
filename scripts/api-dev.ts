import { createServer } from 'node:http'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import auth from '../api/auth.js'
import workspace from '../api/workspace.js'
import history from '../api/history.js'
import write from '../api/write.js'
import reports from '../api/reports.js'
import cleanup from '../api/cleanup.js'
import users from '../api/users.js'
import partners from '../api/partners.js'
import materials from '../api/materials.js'
import variants from '../api/variants.js'
import debugSession from '../api/debug-session.js'
// Local adapter only. Production uses native Vercel functions.
const routes: Record<string, typeof auth> = {
  auth,
  workspace,
  history,
  write,
  reports,
  cleanup,
  users,
  partners,
  materials,
  variants,
  'debug-session': debugSession
}
createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const handler = routes[url.pathname.replace('/api/', '')]
  if (!handler) {
    res.writeHead(404)
    res.end()
    return
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 128000) {
      res.writeHead(413)
      res.end()
      return
    }
    chunks.push(chunk)
  }
  let body
  try {
    const raw = Buffer.concat(chunks).toString()
    body = raw ? JSON.parse(raw) : undefined
  } catch {
    res.writeHead(400)
    res.end()
    return
  }
  const request = Object.assign(req, {
    query: Object.fromEntries(url.searchParams),
    body,
    cookies: {}
  }) as VercelRequest
  const response = Object.assign(res, {
    status(code: number) {
      res.statusCode = code
      return response
    },
    json(value: unknown) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(value))
      return response
    }
  }) as VercelResponse
  await handler(request, response)
}).listen(3001, '127.0.0.1', () =>
  console.log('BOMS API listening on 127.0.0.1:3001')
)
