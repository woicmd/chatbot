import { useState, useEffect, useRef } from 'react'

const s = {
  wrap: {
    margin: '12px 0',
    borderLeft: '2px solid var(--border-hi)',
    paddingLeft: '16px',
    color: 'var(--tx-2)',
  },
  header: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--tx-3)',
    transition: 'color 0.2s ease',
  },
  icon: {
    fontSize: 10,
    transition: 'transform 0.2s ease',
    display: 'inline-block',
  },
  body: {
    marginTop: '10px',
    fontSize: 13,
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--tx-2)',
    fontFamily: 'var(--font-sans)',
    maxHeight: 400,
    overflowY: 'auto',
  },
}

export function ReasoningBlock({ content, isThinking, savedDuration }) {
  // FIX: start at 0, sync from savedDuration via useEffect (reactive, not frozen)
  const [elapsed, setElapsed] = useState(0)
  const [isOpen, setIsOpen]   = useState(isThinking)
  const wasThinking = useRef(isThinking)

  // FIX: savedDuration != null check (not falsy) — handles 0 correctly
  // runs whenever savedDuration arrives (e.g. after localStorage load on refresh)
  useEffect(() => {
    if (!isThinking && savedDuration != null && savedDuration > 0) {
      setElapsed(savedDuration)
    }
  }, [savedDuration, isThinking])

  // Count up while thinking
  useEffect(() => {
    if (!isThinking) return
    const id = setInterval(() => setElapsed((p) => p + 1), 1000)
    return () => clearInterval(id)
  }, [isThinking])

  // Auto-collapse when thinking finishes
  useEffect(() => {
    if (wasThinking.current && !isThinking) {
      setIsOpen(false)
    }
    wasThinking.current = isThinking
  }, [isThinking])

  const label = isThinking
    ? `Thinking… (${elapsed}s)`
    : elapsed > 0
      ? `Thought for ${elapsed}s`
      : 'Reasoning'

  return (
    <div style={s.wrap}>
      <div
        style={s.header}
        onClick={() => setIsOpen((v) => !v)}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tx)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--tx-3)' }}
      >
        <span style={{
          ...s.icon,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>▶</span>
        <span>{label}</span>
      </div>

      {isOpen && (
        <div style={s.body}>
          {content.trim()}
        </div>
      )}
    </div>
  )
}