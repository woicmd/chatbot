import { useState } from 'react'
import { useMessagesStore } from '../store/messages.js'

const s = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    height: 56,
    background: 'var(--bg-deep)',
    borderBottom: '1px solid var(--border)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: 'var(--tx)',
    fontFamily: 'var(--font-sans)',
  },
  separator: {
    width: 1,
    height: 16,
    background: 'var(--border)',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 0.4s',
  },
  statusText: {
    fontSize: 11,
    color: 'var(--tx-3)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 14px',
    fontSize: 12,
    color: 'var(--tx-3)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
}

export function Header({ showSettings, onToggleSettings }) {
  const connected = useMessagesStore((s) => s.connected)
  const streaming = useMessagesStore((s) => s.streaming)
  const clearMessages = useMessagesStore((s) => s.clearMessages)
  const logout = useMessagesStore((s) => s.logout)
  const hasMessages = useMessagesStore((s) => s.messages.length > 0)

  const dotColor = streaming
    ? 'var(--tx-2)'
    : connected
      ? 'var(--ok)'
      : 'var(--err)'

  const statusLabel = streaming
    ? 'Processing…'
    : connected
      ? 'Online'
      : 'Offline'

  return (
    <header style={s.header}>
      <div style={s.left}>
        <span style={s.logo}>Gelembung</span>
        <div style={s.separator} />
        <div style={s.status}>
          <div style={{ ...s.dot, background: dotColor }} />
          <span style={s.statusText}>{statusLabel}</span>
        </div>
      </div>

      <div style={s.right}>
        <button
          id="settings-btn"
          style={{
            ...s.btn,
            borderColor: showSettings ? 'var(--border-hi)' : 'var(--border)',
            color: showSettings ? 'var(--tx)' : 'var(--tx-3)',
          }}
          onClick={onToggleSettings}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hi)'
            e.currentTarget.style.color = 'var(--tx-2)'
          }}
          onMouseLeave={(e) => {
            if (!showSettings) {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--tx-3)'
            }
          }}
        >
          Settings
        </button>

        {hasMessages && (
          <button
            id="clear-chat-btn"
            style={s.btn}
            onClick={clearMessages}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hi)'
              e.currentTarget.style.color = 'var(--tx-2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--tx-3)'
            }}
          >
            Clear
          </button>
        )}

        <button
          id="logout-btn"
          style={{ ...s.btn, color: 'var(--err)' }}
          onClick={logout}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--err)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          Logout
        </button>
      </div>
    </header>
  )
}
