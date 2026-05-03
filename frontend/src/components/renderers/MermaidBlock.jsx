import { useEffect, useRef, useState } from 'react'

let mermaidReady = false
let mermaidPromise = null

function loadMermaid() {
  if (mermaidPromise) return mermaidPromise
  mermaidPromise = import('mermaid').then((m) => {
    const mermaid = m.default
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#1C1C1C',
        primaryColor: '#232323',
        primaryTextColor: '#D4D4D4',
        primaryBorderColor: '#2A2A2A',
        lineColor: '#383838',
        secondaryColor: '#1C1C1C',
        tertiaryColor: '#232323',
        edgeLabelBackground: '#1C1C1C',
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
      },
    })
    mermaidReady = true
    return mermaid
  })
  return mermaidPromise
}

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
    fontSize: 11,
    color: 'var(--tx-3)',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  body: {
    padding: '20px',
    overflowX: 'auto',
    textAlign: 'center',
  },
  error: {
    padding: '14px 16px',
    fontSize: 12,
    color: 'var(--err)',
    fontFamily: 'var(--font-mono)',
  },
}

export function MermaidBlock({ content }) {
  const ref = useRef(null)
  const [error, setError] = useState(null)
  const id = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    let cancelled = false
    setError(null)

    loadMermaid().then(async (mermaid) => {
      if (cancelled || !ref.current) return
      try {
        const { svg } = await mermaid.render(id.current, content)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })

    return () => { cancelled = true }
  }, [content])

  return (
    <div style={s.wrap}>
      <div style={s.header}>Diagram · Mermaid</div>
      {error
        ? (
          <div>
            <div style={s.error}>Parse error: {error}</div>
            <pre style={{
              padding: '14px 16px',
              fontSize: 12,
              color: 'var(--tx-2)',
              fontFamily: 'var(--font-mono)',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              borderTop: '1px solid var(--border)',
              margin: 0,
              background: 'var(--bg-code)',
            }}>{content}</pre>
          </div>
        )
        : <div style={s.body} ref={ref} />
      }
    </div>
  )
}