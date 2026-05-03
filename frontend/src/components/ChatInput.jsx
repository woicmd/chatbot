import { useState, useRef, useEffect, useCallback } from 'react'
import { useMessagesStore } from '../store/messages.js'

const s = {
  wrap: {
    position: 'sticky',
    bottom: 0,
    padding: '16px 28px 24px',
    background: 'linear-gradient(transparent 0%, var(--bg-deep) 24px)',
  },
  inner: {
    maxWidth: 'var(--content-width)',
    margin: '0 auto',
  },
  inputCard: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
  },
  textareaWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    padding: '4px',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    background: 'transparent',
    border: 'none',
    padding: '10px 14px',
    fontSize: 14,
    lineHeight: 1.6,
    fontFamily: 'var(--font-sans)',
    color: 'var(--tx)',
    outline: 'none',
    maxHeight: 180,
    overflowY: 'auto',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    margin: '2px',
    transition: 'all 0.15s',
  },
  sendIcon: {
    width: 16,
    height: 16,
  },
  attachRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '0 14px 10px',
  },
  attachPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    fontSize: 12,
    color: 'var(--tx-2)',
    fontFamily: 'var(--font-sans)',
  },
  attachRemove: {
    background: 'none',
    border: 'none',
    color: 'var(--tx-3)',
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  bottomBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 14px 8px',
    borderTop: '1px solid var(--border)',
    paddingTop: 8,
  },
  actions: {
    display: 'flex',
    gap: 4,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    padding: '4px 8px',
    fontSize: 16,
    color: 'var(--tx-3)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    transition: 'all 0.15s',
  },
  hint: {
    fontSize: 11,
    color: 'var(--tx-4)',
    fontFamily: 'var(--font-sans)',
  },
}

function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsText(file)
  })
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}

export function ChatInput({ onSend, onStop, isStreaming, externalValue, onExternalValueConsumed }) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const streaming = isStreaming ?? useMessagesStore((s) => s.streaming)
  const attachments = useMessagesStore((s) => s.attachments)
  const addAttachment = useMessagesStore((s) => s.addAttachment)
  const removeAttachment = useMessagesStore((s) => s.removeAttachment)
  const clearAttachments = useMessagesStore((s) => s.clearAttachments)
  const ref = useRef(null)
  const fileInputRef = useRef(null)

  // Consume external value from suggestion cards
  useEffect(() => {
    if (externalValue) {
      setText(externalValue)
      onExternalValueConsumed?.()
    }
  }, [externalValue, onExternalValueConsumed])

  // Auto-resize textarea
  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = Math.min(ref.current.scrollHeight, 180) + 'px'
  }, [text])

  // Auto-focus when not streaming
  useEffect(() => {
    if (!streaming) ref.current?.focus()
  }, [streaming])

  // Handle file processing
  const processFile = useCallback(async (file) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const isImage = file.type.startsWith('image/')

    if (isImage) {
      const dataUrl = await readFileAsDataUrl(file)
      addAttachment({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        content: dataUrl,
        dataUrl,
      })
    } else {
      const content = await readFileAsText(file)
      addAttachment({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        content,
      })
    }
  }, [addAttachment])

  // Ctrl+V paste handler
  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.kind === 'file') {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) await processFile(file)
        return
      }
    }
  }, [processFile])

  function submit() {
    const val = text.trim()
    if ((!val && attachments.length === 0) || streaming) return

    // Build message with attachments
    let content = val
    if (attachments.length > 0) {
      const parts = []
      attachments.forEach((a) => {
        if (a.type?.startsWith('image/')) {
          parts.push({ type: 'image_url', image_url: { url: a.dataUrl }, _name: a.name })
        } else {
          parts.push({ type: 'text', text: `--- file: ${a.name} ---\n${a.content}\n---`, _name: a.name })
        }
      })
      parts.push({ type: 'text', text: val })
      content = parts
    }

    onSend(content)
    setText('')
    clearAttachments()
    if (ref.current) ref.current.style.height = 'auto'
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function handleFileBrowse() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e) {
    const files = e.target.files
    if (!files) return
    for (const file of files) {
      await processFile(file)
    }
    e.target.value = ''
  }

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !streaming

  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <div
          style={{
            ...s.inputCard,
            borderColor: focused ? 'var(--border-hi)' : 'var(--border)',
          }}
        >
          {/* Attachment pills */}
          {attachments.length > 0 && (
            <div style={s.attachRow}>
              {attachments.map((a) => (
                <div key={a.id} style={s.attachPill}>
                  <span>{a.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>
                    {a.size < 1024 ? `${a.size}B` : `${(a.size / 1024).toFixed(1)}KB`}
                  </span>
                  <button
                    style={s.attachRemove}
                    onClick={() => removeAttachment(a.id)}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tx)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--tx-3)' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea + Send */}
          <div style={s.textareaWrap}>
            <textarea
              id="chat-input"
              ref={ref}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={streaming ? 'Waiting for response…' : 'Ask anything about code…'}
              disabled={streaming}
              style={{
                ...s.textarea,
                opacity: streaming ? 0.4 : 1,
              }}
            />
            {streaming ? (
              <button
                id="stop-btn"
                onClick={onStop}
                style={{
                  ...s.sendBtn,
                  background: 'var(--err)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              >
                <svg style={s.sendIcon} viewBox="0 0 24 24" fill="var(--bg)" stroke="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                id="send-btn"
                onClick={submit}
                disabled={!canSend}
                style={{
                  ...s.sendBtn,
                  background: canSend ? 'var(--tx-3)' : 'var(--bg-raised)',
                  cursor: canSend ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (canSend) e.currentTarget.style.background = 'var(--tx-2)'
                }}
                onMouseLeave={(e) => {
                  if (canSend) e.currentTarget.style.background = 'var(--tx-3)'
                }}
            >
              <svg style={s.sendIcon} viewBox="0 0 24 24" fill="none" stroke={canSend ? 'var(--bg)' : 'var(--tx-4)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
            )}
          </div>

          {/* Bottom bar */}
          <div style={s.bottomBar}>
            <div style={s.actions}>
              <button
                style={s.actionBtn}
                onClick={handleFileBrowse}
                title="Attach file"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--tx-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-3)' }}
              >
                +
              </button>
            </div>
            <span style={s.hint}>
              ↵ Send · ⇧↵ New line · Ctrl+V Paste file
            </span>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}
