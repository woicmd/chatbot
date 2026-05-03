import { useState } from 'react'

const s = {
  screen: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-deep)',
  },
  card: {
    width: 420,
    maxWidth: '90vw',
    padding: 40,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--tx)',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--tx-3)',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
    lineHeight: 1.6,
    marginTop: -8,
  },
  inputRow: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--tx)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    padding: '10px 14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  btn: {
    background: 'var(--tx-3)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--bg)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: 13,
    padding: '10px 20px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  error: {
    fontSize: 12,
    color: 'var(--err)',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
    marginTop: -8,
  },
  hint: {
    fontSize: 11,
    color: 'var(--tx-4)',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
    lineHeight: 1.6,
  },
}

export function KeyScreen({ onKey }) {
  const [val, setVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const key = val.trim()
    if (!key) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key }),
      })
      const data = await res.json()
      if (data.valid) {
        onKey(key)
      } else {
        setError(data.detail || 'Invalid API key')
      }
    } catch {
      setError('Cannot reach server. Is the backend running?')
    }

    setLoading(false)
  }

  return (
    <div style={s.screen}>
      <div style={s.card}>
        <div style={s.title}>Gelembung</div>
        <div style={s.subtitle}>
          AI Code Tutor — enter your OpenRouter API key to begin.
        </div>

        <div style={s.inputRow}>
          <input
            id="api-key-input"
            type="password"
            style={s.input}
            placeholder="sk-or-v1-..."
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            onFocus={(e) => { e.target.style.borderColor = 'var(--border-hi)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
            autoFocus
          />
          <button
            id="validate-key-btn"
            style={{
              ...s.btn,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onClick={submit}
            disabled={loading}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--tx-2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--tx-3)' }}
          >
            {loading ? 'Validating…' : 'Connect'}
          </button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <div style={s.hint}>
          Get your API key from{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--tx-2)', textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            openrouter.ai
          </a>
        </div>
      </div>
    </div>
  )
}
