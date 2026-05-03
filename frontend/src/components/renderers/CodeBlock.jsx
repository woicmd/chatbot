import { useState, useMemo, useEffect, useDeferredValue } from 'react'
import hljs from 'highlight.js'
import { useMessagesStore } from '../../store/messages.js'

const s = {
  wrap: {
    background: 'var(--bg-raised)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    margin: '12px 0',
    border: '1px solid var(--border)',
  },
  header: {
    padding: '8px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
  },
  lang: {
    fontSize: 11,
    color: 'var(--tx-3)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: 4,
  },
  btn: {
    fontSize: 11,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    color: 'var(--tx-3)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    transition: 'all 0.15s',
  },
  pre: {
    padding: '14px 16px',
    fontSize: 13,
    overflowX: 'auto',
    lineHeight: 1.75,
    margin: 0,
    fontFamily: 'var(--font-mono)',
  },
}

export function CodeBlock({ lang = 'text', content }) {
  const [copied, setCopied] = useState(false)
  const openPanel = useMessagesStore((st) => st.openPanel)
  const panelOpen = useMessagesStore((st) => st.panelOpen)
  const panelContent = useMessagesStore((st) => st.panelContent)
  const blockId = useMemo(() => Math.random().toString(36).slice(2), [])

  const deferredContent = useDeferredValue(content)

  const highlighted = useMemo(() => {
    try {
      if (lang && lang !== 'text' && hljs.getLanguage(lang)) {
        return hljs.highlight(deferredContent, { language: lang }).value
      }
      return hljs.highlightAuto(deferredContent).value
    } catch {
      return deferredContent
    }
  }, [lang, deferredContent])

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  function openInPanel() {
    openPanel({ type: 'code', id: blockId, lang, content })
  }

  useEffect(() => {
    if (panelOpen && panelContent?.id === blockId && panelContent.content !== content) {
      openPanel({ type: 'code', id: blockId, lang, content })
    }
  }, [content, panelOpen, panelContent?.id, blockId, openPanel, lang])

  const lineCount = content.split('\n').filter(Boolean).length

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.lang}>{lang}</span>
        <div style={s.actions}>
          {lineCount > 10 && (
            <button
              style={s.btn}
              onClick={openInPanel}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--tx-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-3)' }}
            >
              Expand
            </button>
          )}
          <button
            style={{ ...s.btn, color: copied ? 'var(--ok)' : 'var(--tx-3)' }}
            onClick={copy}
            onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--tx-2)' } }}
            onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-3)' } }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre style={s.pre}>
        <code
          className="hljs"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  )
}