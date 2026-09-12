import type { VercelRequest, VercelResponse } from '@vercel/node'
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public kind = 'validation'
  ) {
    super(message)
  }
}
export function sameOrigin(req: VercelRequest) {
  const origin = req.headers.origin
  const host = req.headers.host
  if (
    !origin ||
    !host ||
    new URL(origin).host !== host ||
    req.headers['sec-fetch-site'] === 'cross-site'
  ) {
    throw new HttpError(403, 'Request origin is not allowed.', 'authorization')
  }
}
export function method(req: VercelRequest, expected: string) {
  if (req.method !== expected) throw new HttpError(405, 'Method not allowed.')
}
export function route(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<unknown>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      return await handler(req, res)
    } catch (error: unknown) {
      if (error instanceof HttpError)
        return res
          .status(error.status)
          .json({ error: error.message, kind: error.kind })
      const dbError = error as { code?: string; message?: string }
      if (dbError.code === 'P0001')
        return res
          .status(422)
          .json({ error: dbError.message, kind: 'validation' })
      if (dbError.code === '23505')
        return res.status(409).json({
          error:
            'This reference already exists. Refresh and check the recorded entry.',
          kind: 'conflict'
        })
      if (
        [
          '23503',
          '23514',
          '23502',
          '22P02',
          '22003',
          '22007',
          '22008'
        ].includes(dbError.code ?? '')
      ) {
        return res.status(422).json({
          error: 'Check the selected records, dates and quantities.',
          kind: 'validation'
        })
      }
      // Do not log connection strings, request bodies, passwords or SQL parameters.
      console.error('BOMS request failed', {
        code: dbError.code ?? 'unavailable'
      })
      return res.status(503).json({
        error:
          'The service could not confirm this request. Keep the form and retry.',
        kind: 'network'
      })
    }
  }
}
