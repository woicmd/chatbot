import { useRef, useCallback } from 'react'
import { useMessagesStore } from '../store/messages.js'
import { detectNode } from '../lib/detectNode.js'

export function useSSE() {
  const store = useMessagesStore
  const abortRef = useRef(null)
  const fullTextRef = useRef('')
  const reasoningDetailsRef = useRef(null)
  const rafRef = useRef(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    store.getState().setStreaming(false)
    abortRef.current = null
  }, [])

  const send = useCallback(async (userInput) => {
    const state = store.getState()

    state.addMessage({ role: 'user', content: userInput })
    state.addMessage({ role: 'assistant', content: '' })
    state.setStreaming(true)
    state.setActiveNode(null)

    const history = state.getHistory()
    const messagesToSend = history.slice(0, -1)

    fullTextRef.current = ''
    reasoningDetailsRef.current = null

    let displayedLen    = 0
    let fetchDone       = false
    let thinkingStartTime = null
    let thinkingDuration  = 0  // 0 = no thinking phase detected yet

    // ── Adaptive typewriter ───────────────────────────────────────────────────
    function tick() {
      const target = fullTextRef.current.length

      if (displayedLen < target) {
        const buffered = target - displayedLen
        const speed = Math.max(1, Math.min(8, Math.ceil(buffered * 0.05)))
        displayedLen = Math.min(displayedLen + speed, target)
        const current = fullTextRef.current.slice(0, displayedLen)

        // Only update content — no duration/meta during streaming
        store.getState().updateLastAssistant(current)

        if (!store.getState().activeNode && current.length > 10) {
          store.getState().setActiveNode(detectNode(current))
        }

      } else if (fetchDone) {
        // All text rendered + fetch complete → flush final metadata ONCE
        if (!store.getState().activeNode) store.getState().setActiveNode('respond')

        const finalNode    = store.getState().activeNode
        const finalElapsed = store.getState().elapsedMs

        // FIX: only save thinkingDuration if > 0 (actually thought)
        // updateMessageMeta has the same guard, but belt+suspenders here
        if (thinkingDuration > 0) {
          store.getState().updateLastAssistant(
            fullTextRef.current,
            thinkingDuration,
            reasoningDetailsRef.current || undefined
          )
        } else if (reasoningDetailsRef.current) {
          store.getState().updateLastAssistant(
            fullTextRef.current,
            undefined,
            reasoningDetailsRef.current
          )
        }

        store.getState().updateMessageMeta(finalNode, finalElapsed, thinkingDuration)
        store.getState().setStreaming(false)
        abortRef.current = null
        rafRef.current   = null
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    // ── Visibility change (background tab recovery) ───────────────────────────
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const target = fullTextRef.current.length
        if (displayedLen < target) {
          displayedLen = target
          // FIX: no duration here — tick's fetchDone branch handles it
          store.getState().updateLastAssistant(fullTextRef.current)
          if (!store.getState().activeNode && fullTextRef.current.length > 10) {
            store.getState().setActiveNode(detectNode(fullTextRef.current))
          }
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      state.setConnection(true)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesToSend,
          api_key:      store.getState().apiKey || undefined,
          temperature:  store.getState().settings.temperature,
          top_p:        store.getState().settings.top_p,
          thinking_mode: store.getState().thinkingMode,  // ← NEW
        }),
        signal: ctrl.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = (buffer + chunk).split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '"[DONE]"' || raw === '[DONE]') break

          try {
            const token = JSON.parse(raw)
            if (typeof token === 'object' && token !== null) {
              if (token.type === 'node_update') {
                store.getState().setActiveNode(token.node)
                continue
              }
              if (token.type === 'reasoning_details') {
                reasoningDetailsRef.current = token.data
                continue
              }
            }

            fullTextRef.current += token

            // Track thinking phase
            if (fullTextRef.current.includes('<think>') && !thinkingStartTime) {
              thinkingStartTime = Date.now()
            }
            // FIX: Math.max(1, ...) ensures minimum 1s even for fast models
            if (
              fullTextRef.current.includes('</think>') &&
              thinkingStartTime &&
              thinkingDuration === 0
            ) {
              thinkingDuration = Math.max(
                1,
                Math.round((Date.now() - thinkingStartTime) / 1000)
              )
              thinkingStartTime = null
            }

          } catch {
            fullTextRef.current += raw
          }
        }
      }

      fetchDone = true
      document.removeEventListener('visibilitychange', onVisibilityChange)

      // Background tab: flush immediately without typewriter
      if (document.visibilityState !== 'visible' && displayedLen < fullTextRef.current.length) {
        displayedLen = fullTextRef.current.length

        if (!store.getState().activeNode) {
          store.getState().setActiveNode(detectNode(fullTextRef.current) || 'respond')
        }

        const finalNode    = store.getState().activeNode
        const finalElapsed = store.getState().elapsedMs

        store.getState().updateLastAssistant(
          fullTextRef.current,
          thinkingDuration > 0 ? thinkingDuration : undefined,
          reasoningDetailsRef.current || undefined
        )
        store.getState().updateMessageMeta(finalNode, finalElapsed, thinkingDuration)
        store.getState().setStreaming(false)
        abortRef.current = null

        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      }
      // Visible tab → tick() handles fetchDone branch naturally

    } catch (err) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (err.name !== 'AbortError') {
        const s = store.getState()
        const errMsg = fullTextRef.current
          ? fullTextRef.current + '\n\n_[Connection lost]_'
          : '_[Failed to connect to agent. Is the backend running?]_'
        s.updateLastAssistant(errMsg)
        s.setConnection(false)
      }
      store.getState().setStreaming(false)
      abortRef.current = null
    }
  }, [])

  return { send, stop }
}