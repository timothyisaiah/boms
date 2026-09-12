// Split forward SQL scripts while retaining quoted function bodies and comments.
export function statements(source) {
  const result = []
  let start = 0
  let quote = ''
  let comment = ''
  for (let i = 0; i < source.length; i++) {
    const c = source[i],
      next = source[i + 1]
    if (comment === '--') {
      if (c === '\n') comment = ''
      continue
    }
    if (comment === '/*') {
      if (c === '*' && next === '/') {
        comment = ''
        i++
      }
      continue
    }
    if (quote) {
      if (quote.startsWith('$') && source.startsWith(quote, i)) {
        i += quote.length - 1
        quote = ''
      } else if (c === quote) {
        if (next === quote) i++
        else quote = ''
      }
      continue
    }
    if (c === '-' && next === '-') {
      comment = '--'
      i++
      continue
    }
    if (c === '/' && next === '*') {
      comment = '/*'
      i++
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      continue
    }
    if (c === '$') {
      const match = source.slice(i).match(/^\$[a-zA-Z_0-9]*\$/)
      if (match) {
        quote = match[0]
        i += quote.length - 1
        continue
      }
    }
    if (c === ';') {
      const statement = source.slice(start, i + 1).trim()
      if (statement) result.push(statement)
      start = i + 1
    }
  }
  const tail = source.slice(start).trim()
  if (tail && !/^--[^\n]*$/.test(tail)) result.push(tail)
  return result
}
