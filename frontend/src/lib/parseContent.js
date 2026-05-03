const TOKEN_RE = /(?:```(\w*)\n([\s\S]*?)```)|(?:<think>\n?([\s\S]*?)<\/think>)/g

function isDiffPayload(jsonStr) {
  try {
    const arr = JSON.parse(jsonStr)
    return Array.isArray(arr) && arr.length > 0 && 'file_path' in arr[0]
  } catch {
    return false
  }
}

function parseDiffBlocks(jsonStr) {
  const blocks = JSON.parse(jsonStr)
  return blocks.map((b) => {
    const before = b.content.match(/<search>([\s\S]*?)<\/search>/)?.[1]?.trim() ?? ''
    const after  = b.content.match(/<replace>([\s\S]*?)<\/replace>/)?.[1]?.trim() ?? ''
    return { file_path: b.file_path, before, after }
  })
}

/**
 * Splits a raw markdown string into typed segments:
 *   { type: 'markdown', content }
 *   { type: 'code',     lang, content }
 *   { type: 'artifact', lang, content }   — code > 20 lines
 *   { type: 'mermaid',  content }
 *   { type: 'diff',     blocks }          — diff_payload JSON
 *   { type: 'reasoning', content }        — <think> block
 */
export function parseContent(text) {
  const segments = []
  let lastIndex = 0
  let match

  TOKEN_RE.lastIndex = 0
  while ((match = TOKEN_RE.exec(text)) !== null) {
    const prose = text.slice(lastIndex, match.index)
    if (prose) segments.push({ type: 'markdown', content: prose })

    if (match[3] !== undefined) {
      // It's a <think> block
      segments.push({ type: 'reasoning', content: match[3] })
    } else {
      // It's a code block
      const lang = (match[1] || '').toLowerCase()
      const code = match[2] || ''

      if (lang === 'mermaid') {
        segments.push({ type: 'mermaid', content: code })
      } else if (lang === 'json' && isDiffPayload(code)) {
        segments.push({ type: 'diff', blocks: parseDiffBlocks(code) })
      } else if (code.split('\n').filter(Boolean).length > 20) {
        segments.push({ type: 'artifact', lang: lang || 'text', content: code })
      } else {
        segments.push({ type: 'code', lang: lang || 'text', content: code })
      }
    }

    lastIndex = match.index + match[0].length
  }

  const tail = text.slice(lastIndex)
  if (tail) segments.push({ type: 'markdown', content: tail })

  return segments
}