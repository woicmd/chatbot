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
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  lang: {
    fontSize: 11,
    color: 'var(--tx-3)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
  lineCount: {
    fontSize: 11,
    color: 'var(--tx-4)',
    fontFamily: 'var(--font-sans)',
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
  preview: {
    padding: '14px 16px',
    fontSize: 13,
    overflowX: 'auto',
    lineHeight: 1.75,
    maxHeight: 280,
    overflowY: 'hidden',
    margin: 0,
    fontFamily: 'var(--font-mono)',
    position: 'relative',
  },
  fade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    background: 'linear-gradient(transparent, var(--bg-raised))',
    pointerEvents: 'none',
  },
  viewBtn: {
    display: 'block',
    width: '100%',
    padding: '10px',
    background: 'none',
    border: 'none',
    borderTop: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--tx-3)',
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center',
  },
}

export function ArtifactBlock({ lang = 'text', content }) {
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

  const lineCount = content.split('\n').length

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.left}>
          <span style={s.lang}>{lang}</span>
          <span style={s.lineCount}>{lineCount} lines</span>
        </div>
        <div style={s.actions}>
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
      {/* Collapsed preview */}
      <div style={{ position: 'relative' }}>
        <pre style={s.preview}>
          <code
            className="hljs"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
        <div style={s.fade} />
      </div>
      <button
        style={s.viewBtn}
        onClick={openInPanel}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--tx-2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-3)' }}
      >
        View full code →
      </button>
    </div>
  )
}