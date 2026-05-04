// Phase 1: find think blocks → split text
// Phase 2: find code blocks within non-think segments
// Prevents code block regex from "stealing" content inside think blocks

function isDiffPayload(jsonStr) {
  try {
    const arr = JSON.parse(jsonStr)
    return Array.isArray(arr) && arr.length > 0 && 'file_path' in arr[0]
  } catch { return false }
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
 * Parse code blocks (```) within a plain text segment.
 * Only called on non-think portions of the content.
 */
function parseCodeSegment(text, out) {
  const CODE_RE = /```(\w*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  CODE_RE.lastIndex = 0
  while ((match = CODE_RE.exec(text)) !== null) {
    const prose = text.slice(lastIndex, match.index)
    if (prose) out.push({ type: 'markdown', content: prose })

    const lang = (match[1] || '').toLowerCase()
    const code = match[2] || ''

    if (lang === 'mermaid') {
      out.push({ type: 'mermaid', content: code })
    } else if (lang === 'json' && isDiffPayload(code)) {
      out.push({ type: 'diff', blocks: parseDiffBlocks(code) })
    } else if (code.split('\n').filter(Boolean).length > 20) {
      out.push({ type: 'artifact', lang: lang || 'text', content: code })
    } else {
      out.push({ type: 'code', lang: lang || 'text', content: code })
    }

    lastIndex = match.index + match[0].length
  }

  const tail = text.slice(lastIndex)
  if (tail) out.push({ type: 'markdown', content: tail })
}

/**
 * Main parser.
 * Splits text into typed segments:
 *   { type: 'markdown'  | 'code' | 'artifact' | 'mermaid' | 'diff' | 'reasoning' }
 *
 * Strategy:
 *   1. First split by <think>...</think> — prevents regex cross-contamination
 *   2. Then parse code blocks within non-thinking portions
 */
export function parseContent(text) {
  const segments = []

  // Phase 1: locate all <think>...</think> blocks
  const THINK_RE = /<think>\n?([\s\S]*?)<\/think>\n*/g
  let lastIndex = 0
  let match

  THINK_RE.lastIndex = 0
  while ((match = THINK_RE.exec(text)) !== null) {
    // Content before this think block → parse for code blocks
    const before = text.slice(lastIndex, match.index)
    if (before) parseCodeSegment(before, segments)

    // The thinking content itself
    segments.push({ type: 'reasoning', content: match[1] || '' })

    lastIndex = match.index + match[0].length
  }

  // Phase 2: remaining text after last think block
  const tail = text.slice(lastIndex)
  if (tail) parseCodeSegment(tail, segments)

  return segments
}