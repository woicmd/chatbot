import { useState, useEffect, useRef } from 'react'

const s = {
  wrap: {
    margin: '16px 0',
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
  },
  body: {
    marginTop: '12px',
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--tx-2)',
    fontFamily: 'var(--font-sans)',
  }
}

export function ReasoningBlock({ content, isThinking, savedDuration }) {
  // If we have a saved duration from localStorage (after refresh), use it
  // Otherwise start counting from 0
  const [elapsed, setElapsed] = useState(() => savedDuration || 0)
  const [isOpen, setIsOpen] = useState(isThinking)
  const wasThinking = useRef(isThinking)

  // Count up while thinking
  useEffect(() => {
    if (isThinking) {
      const interval = setInterval(() => {
        setElapsed(prev => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isThinking])

  // Auto-collapse when thinking finishes
  useEffect(() => {
    if (wasThinking.current && !isThinking) {
      setIsOpen(false)
    }
    wasThinking.current = isThinking
  }, [isThinking])

  return (
    <div style={s.wrap}>
      <div 
        style={s.header} 
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--tx)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--tx-3)'}
      >
        <span style={{ ...s.icon, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        <span>{isThinking ? `Thinking... (${elapsed}s)` : `Thought for ${elapsed}s`}</span>
      </div>
      {isOpen && (
        <div style={s.body}>
          {content.trim()}
        </div>
      )}
    </div>
  )
}
