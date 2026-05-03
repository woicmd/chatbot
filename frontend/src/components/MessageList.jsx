import { useRef, useEffect, useState, useCallback } from 'react'
import { useMessagesStore } from '../store/messages.js'
import { Message } from './Message.jsx'

const s = {
  wrap: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px 28px',
    position: 'relative',
  },
  inner: {
    maxWidth: 'var(--content-width)',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 32,
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--tx)',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '-0.01em',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'var(--tx-3)',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 380,
  },
  suggestions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    maxWidth: 520,
    width: '100%',
  },
  suggestionCard: {
    padding: '14px 16px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--tx)',
    marginBottom: 4,
    fontFamily: 'var(--font-sans)',
  },
  suggestionDesc: {
    fontSize: 12,
    color: 'var(--tx-3)',
    fontFamily: 'var(--font-sans)',
    lineHeight: 1.5,
  },
  scrollFab: {
    position: 'sticky',
    bottom: 16,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  scrollBtn: {
    pointerEvents: 'auto',
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    color: 'var(--tx-2)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    lineHeight: 1,
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
}

const SUGGESTIONS = [
  {
    title: 'Debug my code',
    desc: 'Find and fix issues in your code with detailed explanations',
    prompt: 'Help me debug this code:',
  },
  {
    title: 'Refactor code',
    desc: 'Improve code structure, readability, and performance',
    prompt: 'Refactor this code to be more maintainable:',
  },
  {
    title: 'Explain a concept',
    desc: 'Get clear explanations of programming concepts',
    prompt: 'Explain how this works:',
  },
  {
    title: 'System design',
    desc: 'Architecture patterns, trade-offs, and best practices',
    prompt: 'Design a system for:',
  },
]

export function MessageList({ onSuggestionClick }) {
  const messages = useMessagesStore((s) => s.messages)
  const streaming = useMessagesStore((s) => s.streaming)
  const activeNode = useMessagesStore((s) => s.activeNode)
  const elapsedMs = useMessagesStore((s) => s.elapsedMs)
  const streamStartTime = useMessagesStore((s) => s.streamStartTime)
  const setElapsed = useMessagesStore((s) => s.setElapsed)

  const bottomRef = useRef(null)
  const wrapRef = useRef(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const userScrolledUp = useRef(false)
  const prevMsgCount = useRef(messages.length)

  // Track if user has scrolled away from bottom
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const onScroll = () => {
      // Use a very low threshold (15px) so even a tiny scroll detaches the auto-scroll
      const distFromBottom = el.scrollHeight - Math.ceil(el.scrollTop) - el.clientHeight
      userScrolledUp.current = distFromBottom > 15
      // Show FAB only when streaming and scrolled up
      setShowScrollBtn(distFromBottom > 15 && streaming)
    }

    // Instantly detach if user actively scrolls up via mouse wheel
    const onWheel = (e) => {
      if (e.deltaY < 0) {
        userScrolledUp.current = true
      }
    }

    // Instantly detach on touch swipe down (which scrolls up)
    let touchStartY = 0
    const onTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      if (e.touches[0].clientY > touchStartY + 5) {
        userScrolledUp.current = true
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [streaming])

  // When user sends a new message, force scroll to bottom
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const lastMsg = messages[messages.length - 1]
      // User just sent a message — scroll to bottom immediately
      if (lastMsg?.role === 'user') {
        userScrolledUp.current = false
        setShowScrollBtn(false)
        // Use setTimeout to ensure the DOM has rendered the new message
        setTimeout(() => {
          if (wrapRef.current) {
            wrapRef.current.scrollTo({ top: wrapRef.current.scrollHeight, behavior: 'smooth' })
          }
        }, 50)
      }
    }
    prevMsgCount.current = messages.length
  }, [messages.length])

  // Auto-scroll when near bottom during streaming
  useEffect(() => {
    if (!userScrolledUp.current && wrapRef.current) {
      // Direct scrollTop assignment avoids the 60fps scrollIntoView "earthquake" jitter
      wrapRef.current.scrollTop = wrapRef.current.scrollHeight
    }
  }, [messages, streaming])

  // Update FAB visibility when streaming state changes
  useEffect(() => {
    if (!streaming) {
      setShowScrollBtn(false)
    } else if (userScrolledUp.current) {
      setShowScrollBtn(true)
    }
  }, [streaming])

  // Elapsed timer
  useEffect(() => {
    if (!streaming || !streamStartTime) return
    const id = setInterval(() => {
      setElapsed(Date.now() - streamStartTime)
    }, 100)
    return () => clearInterval(id)
  }, [streaming, streamStartTime, setElapsed])

  const scrollToBottom = useCallback(() => {
    userScrolledUp.current = false
    setShowScrollBtn(false)
    if (wrapRef.current) {
      wrapRef.current.scrollTo({ top: wrapRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [])

  if (messages.length === 0) {
    return (
      <div style={s.wrap}>
        <div style={s.empty}>
          <div>
            <div style={s.emptyTitle}>Gelembung</div>
            <div style={s.emptySubtitle}>
              AI code assistant — debug, refactor, explain, and design.
            </div>
          </div>

          <div style={s.suggestions}>
            {SUGGESTIONS.map((sg, i) => (
              <div
                key={i}
                style={s.suggestionCard}
                onClick={() => onSuggestionClick?.(sg.prompt)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-hi)'
                  e.currentTarget.style.background = 'var(--bg-raised)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.background = 'var(--bg)'
                }}
              >
                <div style={s.suggestionTitle}>{sg.title}</div>
                <div style={s.suggestionDesc}>{sg.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={s.wrap}>
      <div style={s.inner}>
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1
          const isAssistant = msg.role === 'assistant'
          return (
            <Message
              key={i}
              message={msg}
              isStreaming={isLast && isAssistant && streaming}
              activeNode={isLast && isAssistant ? (activeNode || msg.node) : msg.node}
              elapsedMs={isLast && isAssistant && !streaming ? (elapsedMs || msg.elapsedMs) : msg.elapsedMs}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom FAB — only visible during streaming when scrolled up */}
      {showScrollBtn && (
        <div style={s.scrollFab}>
          <button
            style={s.scrollBtn}
            onClick={scrollToBottom}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hi)'
              e.currentTarget.style.color = 'var(--tx)'
              e.currentTarget.style.background = 'var(--bg-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--tx-2)'
              e.currentTarget.style.background = 'var(--bg-raised)'
            }}
            title="Scroll to bottom"
          >
            ↓
          </button>
        </div>
      )}
    </div>
  )
}
