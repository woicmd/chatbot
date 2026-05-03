import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseContent } from '../lib/parseContent.js'
import { CodeBlock } from './renderers/CodeBlock.jsx'
import { ArtifactBlock } from './renderers/ArtifactBlock.jsx'
import { MermaidBlock } from './renderers/MermaidBlock.jsx'
import { DiffViewer } from './renderers/DiffViewer.jsx'
import { ReasoningBlock } from './renderers/ReasoningBlock.jsx'

const NODE_LABELS = {
  respond: 'Respond',
  explainer: 'Explainer',
  refactorer: 'Refactorer',
  debugger: 'Debugger',
  architect: 'Architect',
  coder: 'Coder',
  researcher: 'Researcher',
  router: 'Routing...',
  sandbox_evaluator: 'Sandbox Evaluator',
  debugger_evaluator: 'Debugger Check',
  thinking: 'Thinking...',
  error: 'Error',
}

const s = {
  userWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
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
  agentWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  meta: {
    fontSize: 12,
    color: 'var(--tx-3)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
  nodeTag: {
    fontSize: 11,
    color: 'var(--tx-2)',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    padding: '2px 10px',
    borderRadius: 12,
    fontWeight: 500,
  },
  errorTag: {
    fontSize: 11,
    color: 'var(--err)',
    background: 'var(--err-bg)',
    border: '1px solid rgba(138,107,107,0.2)',
    padding: '2px 10px',
    borderRadius: 12,
    fontWeight: 500,
  },
  body: {
    fontSize: 14,
    lineHeight: 1.7,
  },
  prose: {
    fontFamily: 'var(--font-sans)',
    color: 'var(--tx)',
    fontSize: 14,
    lineHeight: 1.7,
  },
}

// Recursively extract plain text from React element children
function extractText(node) {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node.props?.children) return extractText(node.props.children)
  return ''
}

const proseComponents = {
  p: ({ children }) => <p style={{ marginBottom: 12 }}>{children}</p>,
  strong: ({ children }) => <strong style={{ color: 'var(--tx)', fontWeight: 600 }}>{children}</strong>,
  em: ({ children }) => <em style={{ color: 'var(--tx-2)', fontStyle: 'italic' }}>{children}</em>,
  code: ({ children, className }) => {
    const content = extractText(children)
    const isBlock = className || content.includes('\n')

    if (isBlock) {
      const lang = className ? className.replace(/language-/, '').replace(/\s*hljs/, '').trim() : 'text'
      const trimmed = content.trim()
      
      const lines = trimmed.split('\n').filter(Boolean).length
      if (lines > 20) return <ArtifactBlock lang={lang} content={trimmed} />
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
  h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx)', marginBottom: 8, marginTop: 14 }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 6, marginTop: 12 }}>{children}</h3>,
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
    <a href={href} style={{ color: 'var(--tx)', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--tx-3)' }}>{children}</a>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />,
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '12px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
      }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th style={{
      padding: '8px 14px',
      textAlign: 'left',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--tx-2)',
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{
      padding: '8px 14px',
      color: 'var(--tx)',
      verticalAlign: 'top',
    }}>
      {children}
    </td>
  ),
}

function ContentRenderer({ content, isStreaming, thinkingDuration }) {
  let cleanContent = content
  const unclosedThink = cleanContent.includes('<think>') && !cleanContent.includes('</think>')
  
  if (unclosedThink) {
    cleanContent += '\n</think>'
  }

  const segments = parseContent(cleanContent)

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'markdown') {
          return (
            <div key={i} style={s.prose}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={proseComponents}
              >
                {seg.content}
              </ReactMarkdown>
            </div>
          )
        }
        if (seg.type === 'code') return <CodeBlock key={i} lang={seg.lang} content={seg.content} />
        if (seg.type === 'artifact') return <ArtifactBlock key={i} lang={seg.lang} content={seg.content} />
        if (seg.type === 'reasoning') {
          // It's thinking if the original stream doesn't have the closing tag yet AND we are currently streaming
          const isThinking = isStreaming && unclosedThink && i === segments.length - 1
          return <ReasoningBlock key={i} content={seg.content} isThinking={isThinking} savedDuration={thinkingDuration} />
        }
        if (seg.type === 'mermaid') return <MermaidBlock key={i} content={seg.content} />
        if (seg.type === 'diff') return <DiffViewer key={i} blocks={seg.blocks} />
        return null
      })}
    </>
  )
}

import { useMessagesStore } from '../store/messages.js'
import { memo } from 'react'

export const Message = memo(function Message({ message, isStreaming, activeNode, elapsedMs }) {
  const openPanel = useMessagesStore((s) => s.openPanel)

  if (message.role === 'user') {
    const renderUserContent = () => {
      if (typeof message.content === 'string') return message.content

      const parts = message.content
      const fileParts = parts.filter(p => p._name)
      const userText = parts.filter(p => !p._name && p.type === 'text').pop()?.text ?? ''

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fileParts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {fileParts.map((f, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (f.type === 'image_url') {
                      openPanel({
                        type: 'file',
                        filename: f._name,
                        contentType: 'image/png',
                        dataUrl: f.image_url?.url
                      })
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
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--tx)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--tx-2)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {f.type === 'image_url' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    )}
                  </span>
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

  const node = activeNode || (isStreaming && !message.content ? 'thinking' : 'respond')
  const isError = node === 'error'
  const label = NODE_LABELS[node] ?? node
  const elapsed = elapsedMs ? `${(elapsedMs / 1000).toFixed(1)}s` : ''

  return (
    <div className="msg-enter" style={s.agentWrap}>
      <div style={s.meta}>
        <span>Agent</span>
      </div>
      <div style={s.body}>
        {message.content
          ? <ContentRenderer content={message.content.replace(/^\[.*?\][\s\S]*?\n\n?/i, '')} isStreaming={isStreaming} thinkingDuration={message.thinkingDuration} />
          : isStreaming && <span className="cursor" />
        }
      </div>
    </div>
  )
})