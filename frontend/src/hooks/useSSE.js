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
    let displayedLen = 0
    let fetchDone = false
    let thinkingStartTime = null
    let thinkingDuration = 0

    // Adaptive typewriter — adjusts speed based on buffered text
    function tick() {
      const target = fullTextRef.current.length

      // Continuously update thinking duration in the store even if no new text arrives
      if (thinkingStartTime && !thinkingDuration) {
        const currentDur = Math.round((Date.now() - thinkingStartTime) / 1000)
        const lastMsg = store.getState().getHistory().slice(-1)[0]
        if (lastMsg && currentDur > (lastMsg.thinkingDuration || 0)) {
          store.getState().updateLastAssistant(lastMsg.content, currentDur)
        }
      }

      if (displayedLen < target) {
        const buffered = target - displayedLen
        // Min 1 char, max 8 chars per frame for a smooth, readable typing effect
        const speed = Math.max(1, Math.min(8, Math.ceil(buffered * 0.05)))
        displayedLen = Math.min(displayedLen + speed, target)
        const current = fullTextRef.current.slice(0, displayedLen)

        // Pass the already known thinking duration when updating text
        let currentDur = thinkingDuration
        if (thinkingStartTime && !thinkingDuration) {
          currentDur = Math.round((Date.now() - thinkingStartTime) / 1000)
        }
        store.getState().updateLastAssistant(current, currentDur)

        if (!store.getState().activeNode && current.length > 10) {
          store.getState().setActiveNode(detectNode(current))
        }
      } else if (fetchDone) {
        if (!store.getState().activeNode) store.getState().setActiveNode('respond')
        store.getState().setStreaming(false)
        abortRef.current = null
        rafRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const target = fullTextRef.current.length
        if (displayedLen < target) {
          displayedLen = target

          let currentDur = thinkingDuration
          if (thinkingStartTime && !thinkingDuration) {
            currentDur = Math.round((Date.now() - thinkingStartTime) / 1000)
          }

          store.getState().updateLastAssistant(fullTextRef.current, currentDur)
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
          api_key: store.getState().apiKey || undefined,
          temperature: store.getState().settings.temperature,
          top_p: store.getState().settings.top_p,
        }),
        signal: ctrl.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
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
            if (fullTextRef.current.includes('<think>') && !thinkingStartTime) {
              thinkingStartTime = Date.now()
            }
            if (fullTextRef.current.includes('</think>') && thinkingStartTime) {
              thinkingDuration = Math.round((Date.now() - thinkingStartTime) / 1000)
              thinkingStartTime = null
            }
          } catch {
            fullTextRef.current += raw
          }
        }
      }

      fetchDone = true
      document.removeEventListener('visibilitychange', onVisibilityChange)

      // Flush if rAF was paused (background tab)
      if (document.visibilityState !== 'visible' && displayedLen < fullTextRef.current.length) {
        displayedLen = fullTextRef.current.length
        store.getState().updateLastAssistant(
          fullTextRef.current,
          thinkingDuration,
          reasoningDetailsRef.current || undefined
        )
        if (!store.getState().activeNode) {
          store.getState().setActiveNode(detectNode(fullTextRef.current) || 'respond')
        }
        store.getState().updateMessageMeta(store.getState().activeNode, store.getState().elapsedMs, thinkingDuration)
        store.getState().setStreaming(false)
        abortRef.current = null
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      } else {
        // Even if visible, make sure we persist the meta data
        store.getState().updateMessageMeta(store.getState().activeNode, store.getState().elapsedMs, thinkingDuration)
      }
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