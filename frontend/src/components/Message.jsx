import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { memo } from 'react'
import { parseContent } from '../lib/parseContent.js'
import { CodeBlock } from './renderers/CodeBlock.jsx'
import { ArtifactBlock } from './renderers/ArtifactBlock.jsx'
import { MermaidBlock } from './renderers/MermaidBlock.jsx'
import { DiffViewer } from './renderers/DiffViewer.jsx'
import { ReasoningBlock } from './renderers/ReasoningBlock.jsx'
import { useMessagesStore } from '../store/messages.js'

const NODE_LABELS = {
  respond:             'Respond',
  explainer:           'Explainer',
  refactorer:          'Refactorer',
  debugger:            'Debugger',
  architect:           'Architect',
  coder:               'Coder',
  researcher:          'Researcher',
  router:              'Routing…',
  sandbox_evaluator:   'Sandbox',
  debugger_evaluator:  'Evaluator',
  thinking:            'Thinking…',
  error:               'Error',
}

const s = {
  userWrap: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: {
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '12px 18px',
    maxWidth: '72%',
    color: 'var(--tx)',
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'var(--font-sans)',
  },
  agentWrap: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  meta: {
    fontSize: 12,
    color: 'var(--tx-3)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    minHeight: 20,
  },
  nodeTag: {
    fontSize: 11,
    color: 'var(--tx-2)',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    padding: '1px 8px',
    borderRadius: 10,
    fontWeight: 500,
  },
  elapsedTag: {
    fontSize: 11,
    color: 'var(--tx-4)',
    fontFamily: 'var(--font-mono)',
  },
  body: { fontSize: 14, lineHeight: 1.7 },
  prose: { fontFamily: 'var(--font-sans)', color: 'var(--tx)', fontSize: 14, lineHeight: 1.7 },
  waitingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--tx-3)',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
  },
}

function extractText(node) {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node.props?.children) return extractText(node.props.children)
  return ''
}

const proseComponents = {
  p:  ({ children }) => <p style={{ marginBottom: 12 }}>{children}</p>,
  strong: ({ children }) => <strong style={{ color: 'var(--tx)', fontWeight: 600 }}>{children}</strong>,
  em: ({ children }) => <em style={{ color: 'var(--tx-2)', fontStyle: 'italic' }}>{children}</em>,
  code: ({ children, className }) => {
    const content = extractText(children)
    const isBlock = className || content.includes('\n')
    if (isBlock) {
      const lang = className
        ? className.replace(/language-/, '').replace(/\s*hljs/, '').trim()
        : 'text'
      const trimmed = content.trim()
      if (trimmed.split('\n').filter(Boolean).length > 20)
        return <ArtifactBlock lang={lang} content={trimmed} />
      return <CodeBlock lang={lang} content={trimmed} />
    }
    return (
      <code style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        background: 'var(--bg-raised)',
        padding: '2px 7px',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--tx)',
        border: '1px solid var(--border)',
      }}>
        {children}
      </code>
    )
  },
  ul: ({ children }) => <ul style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 4, color: 'var(--tx)' }}>{children}</li>,
  h1: ({ children }) => <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tx)', marginBottom: 10, marginTop: 16 }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx)', marginBottom: 8,  marginTop: 14 }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 6,  marginTop: 12 }}>{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: '2px solid var(--border-hi)',
      paddingLeft: 14,
      color: 'var(--tx-2)',
      margin: '10px 0',
      fontStyle: 'italic',
    }}>
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} style={{ color: 'var(--tx)', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--tx-3)' }}>
      {children}
    </a>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />,
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '12px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr:   ({ children }) => <tr style={{ borderBottom: '1px solid var(--border)' }}>{children}</tr>,
  th:   ({ children }) => (
    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '8px 14px', color: 'var(--tx)', verticalAlign: 'top' }}>{children}</td>
  ),
}

// ── ContentRenderer ────────────────────────────────────────────────────────────
function ContentRenderer({ content, isStreaming, thinkingDuration }) {
  const hasOpenThink  = content.includes('<think>')
  const hasCloseThink = content.includes('</think>')

  // FIX: detect active thinking phase explicitly
  // → prevents unclosed <think> from leaking into markdown renderer
  const isActivelyThinking = hasOpenThink && !hasCloseThink && isStreaming

  let processedContent = content
  if (hasOpenThink && !hasCloseThink) {
    // Temporarily close the think block for parseContent to work
    processedContent = content + '\n</think>'
  }

  const segments = parseContent(processedContent)

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'markdown') {
          // FIX: skip empty/whitespace-only markdown segments
          if (!seg.content.trim()) return null
          return (
            <div key={i} style={s.prose}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={proseComponents}>
                {seg.content}
              </ReactMarkdown>
            </div>
          )
        }
        if (seg.type === 'code')     return <CodeBlock     key={i} lang={seg.lang} content={seg.content} />
        if (seg.type === 'artifact') return <ArtifactBlock key={i} lang={seg.lang} content={seg.content} />
        if (seg.type === 'mermaid')  return <MermaidBlock  key={i} content={seg.content} />
        if (seg.type === 'diff')     return <DiffViewer    key={i} blocks={seg.blocks} />
        if (seg.type === 'reasoning') {
          // FIX: only the first reasoning segment is "actively thinking"
          // subsequent reasoning segments (from prior turns) are already done
          const firstReasoningIdx = segments.findIndex((s) => s.type === 'reasoning')
          const isThinkingNow = isActivelyThinking && i === firstReasoningIdx
          return (
            <ReasoningBlock
              key={i}
              content={seg.content}
              isThinking={isThinkingNow}
              savedDuration={thinkingDuration}
            />
          )
        }
        return null
      })}
    </>
  )
}

// ── Message ────────────────────────────────────────────────────────────────────
export const Message = memo(function Message({ message, isStreaming, activeNode, elapsedMs }) {
  const openPanel = useMessagesStore((s) => s.openPanel)

  // User message
  if (message.role === 'user') {
    const renderUserContent = () => {
      if (typeof message.content === 'string') return message.content

      const parts    = message.content
      const fileParts = parts.filter((p) => p._name)
      const userText  = parts.filter((p) => !p._name && p.type === 'text').pop()?.text ?? ''

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fileParts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {fileParts.map((f, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (f.type === 'image_url') {
                      openPanel({ type: 'file', filename: f._name, contentType: 'image/png', dataUrl: f.image_url?.url })
                    } else {
                      openPanel({
                        type: 'code',
                        lang: f._name.split('.').pop(),
                        content: f.text ? f.text.replace(/^--- file: .+? ---\n/, '').replace(/\n---$/, '') : '',
                        filename: f._name
                      })
                    }
                  }}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    padding: '4px 10px',
                    borderRadius: 14,
                    fontSize: 12,
                    color: 'var(--tx-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--tx)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)';    e.currentTarget.style.color = 'var(--tx-2)' }}
                >
                  <span>{f.type === 'image_url' ? '🖼' : '📄'}</span>
                  <span>{f._name}</span>
                </button>
              ))}
            </div>
          )}
          {userText && <div style={{ whiteSpace: 'pre-wrap' }}>{userText}</div>}
        </div>
      )
    }

    return (
      <div className="msg-enter" style={s.userWrap}>
        <div style={s.userBubble}>{renderUserContent()}</div>
      </div>
    )
  }

  // Assistant message
  const displayNode = activeNode || (isStreaming && !message.content ? 'thinking' : null)
  const label = displayNode ? (NODE_LABELS[displayNode] ?? displayNode) : null

  // Strip agent prefixes like "[Researcher] Title\n\n" from specialist output
  const rawContent = message.content || ''
  const strippedContent = rawContent.replace(/^\[.*?\][^\n]*\n\n?/, '')

  return (
    <div className="msg-enter" style={s.agentWrap}>
      {/* Meta bar — show node + elapsed when streaming */}
      <div style={s.meta}>
        <span style={{ color: 'var(--tx-4)', fontSize: 11 }}>Agent</span>

        {isStreaming && label && label !== 'Respond' && (
          <span style={s.nodeTag}>{label}</span>
        )}

        {/* FIX issue 3: show elapsed time so user knows something is happening */}
        {isStreaming && elapsedMs > 1500 && (
          <span style={s.elapsedTag}>{(elapsedMs / 1000).toFixed(0)}s</span>
        )}
      </div>

      <div style={s.body}>
        {strippedContent ? (
          <ContentRenderer
            content={strippedContent}
            isStreaming={isStreaming}
            thinkingDuration={message.thinkingDuration}
          />
        ) : isStreaming ? (
          /* Waiting state — before first token arrives (issue 3 UX) */
          <div style={s.waitingWrap}>
            <span className="cursor" />
            <span style={{ fontSize: 12, color: 'var(--tx-4)' }}>
              {displayNode && displayNode !== 'thinking'
                ? `${NODE_LABELS[displayNode] || displayNode}…`
                : 'Generating response…'
              }
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
})