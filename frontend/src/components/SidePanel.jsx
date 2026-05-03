import { useEffect, useRef, useMemo, useState, useCallback, useDeferredValue } from 'react'
import hljs from 'highlight.js'
import { useMessagesStore } from '../store/messages.js'
import { FilePreview } from './renderers/FilePreview.jsx'

const MIN_WIDTH = 320
const MAX_WIDTH_RATIO = 0.85
const DEFAULT_WIDTH = 480

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    background: 'rgba(0,0,0,0.3)',
    cursor: 'pointer',
  },
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    background: 'var(--bg)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    left: -4,
    bottom: 0,
    width: 8,
    cursor: 'col-resize',
    zIndex: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeLine: {
    width: 2,
    height: 40,
    borderRadius: 2,
    background: 'var(--border)',
    transition: 'background 0.15s, height 0.15s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--tx-2)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-sans)',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 10px',
    fontSize: 11,
    color: 'var(--tx-3)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: 'var(--tx-3)',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 0,
  },
  codeWrap: {
    padding: '16px 20px',
  },
  langLabel: {
    fontSize: 11,
    color: 'var(--tx-3)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
  pre: {
    margin: 0,
    padding: '16px',
    background: 'var(--bg-raised)',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    lineHeight: 1.7,
    fontFamily: 'var(--font-mono)',
    overflowX: 'auto',
    color: 'var(--tx)',
    border: '1px solid var(--border)',
  },
  footer: {
    borderTop: '1px solid var(--border)',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  footerInfo: {
    fontSize: 11,
    color: 'var(--tx-3)',
    fontFamily: 'var(--font-mono)',
  },
}

export function SidePanel() {
  const panelOpen = useMessagesStore((s) => s.panelOpen)
  const panelContent = useMessagesStore((s) => s.panelContent)
  const closePanel = useMessagesStore((s) => s.closePanel)
  const panelRef = useRef(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(0)
  
  const deferredPanelContent = useDeferredValue(panelContent)

  // Close on Escape
  useEffect(() => {
    if (!panelOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') closePanel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [panelOpen, closePanel])

  // Drag resize logic
  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartW.current = width
    setDragging(true)
  }, [width])

  useEffect(() => {
    if (!dragging) return

    const onMouseMove = (e) => {
      const delta = dragStartX.current - e.clientX
      const maxW = window.innerWidth * MAX_WIDTH_RATIO
      const newWidth = Math.max(MIN_WIDTH, Math.min(maxW, dragStartW.current + delta))
      setWidth(newWidth)
    }

    const onMouseUp = () => {
      setDragging(false)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [dragging])

  const highlighted = useMemo(() => {
    if (!deferredPanelContent || deferredPanelContent.type !== 'code') return ''
    const lang = deferredPanelContent.lang || 'text'
    const code = deferredPanelContent.content || ''
    try {
      if (lang !== 'text' && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    } catch {
      return code
    }
  }, [deferredPanelContent])

  if (!panelOpen || !panelContent) return null

  const isCode = panelContent.type === 'code'
  const isFile = panelContent.type === 'file'

  function handleCopy() {
    const text = panelContent.content || ''
    navigator.clipboard.writeText(text)
  }

  const lineCount = isCode
    ? (panelContent.content || '').split('\n').length
    : null

  return (
    <>
      <div style={s.overlay} onClick={closePanel} />
      <div
        ref={panelRef}
        className="panel-enter"
        style={{ ...s.panel, width }}
      >
        {/* Resize drag handle */}
        <div
          style={s.resizeHandle}
          onMouseDown={onMouseDown}
          onMouseEnter={(e) => {
            const line = e.currentTarget.querySelector('[data-resize-line]')
            if (line) { line.style.background = 'var(--accent)'; line.style.height = '60px' }
          }}
          onMouseLeave={(e) => {
            if (!dragging) {
              const line = e.currentTarget.querySelector('[data-resize-line]')
              if (line) { line.style.background = 'var(--border)'; line.style.height = '40px' }
            }
          }}
        >
          <div data-resize-line style={s.resizeLine} />
        </div>

        {/* Header */}
        <div style={s.header}>
          <span style={s.title}>
            {isCode ? (panelContent.filename || panelContent.lang || 'Code') : 'File Preview'}
          </span>
          <div style={s.controls}>
            {isCode && (
              <button
                style={s.btn}
                onClick={handleCopy}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tx)'; e.currentTarget.style.borderColor = 'var(--border-hi)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--tx-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                Copy
              </button>
            )}
            <button
              style={s.closeBtn}
              onClick={closePanel}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tx)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--tx-3)' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={s.body}>
          {isCode && (
            <div style={s.codeWrap}>
              {panelContent.lang && (
                <div style={s.langLabel}>{panelContent.lang}</div>
              )}
              <div style={{ ...s.pre, padding: 0, display: 'flex', overflowX: 'auto' }}>
                <div style={{
                  padding: '16px 12px',
                  borderRight: '1px solid var(--border)',
                  color: 'var(--tx-4)',
                  textAlign: 'right',
                  userSelect: 'none',
                  minWidth: 40,
                  flexShrink: 0,
                  background: 'rgba(0,0,0,0.1)'
                }}>
                  {Array.from({ length: lineCount || 1 }).map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <pre style={{ margin: 0, padding: '16px', overflowX: 'visible', flex: 1, fontFamily: 'var(--font-mono)' }}>
                  <code
                    className="hljs"
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                  />
                </pre>
              </div>
            </div>
          )}
          {isFile && (
            <FilePreview file={panelContent} />
          )}
        </div>

        {/* Footer */}
        {isCode && lineCount && (
          <div style={s.footer}>
            <span style={s.footerInfo}>{lineCount} lines</span>
            <span style={s.footerInfo}>{panelContent.lang || 'text'}</span>
          </div>
        )}
      </div>
    </>
  )
}
