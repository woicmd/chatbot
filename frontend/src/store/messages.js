import { create } from 'zustand'

const LS_KEY           = 'gelembung_api_key'
const LS_MESSAGES      = 'gelembung_messages'
const LS_SETTINGS      = 'gelembung_settings'
const LS_THINKING_MODE = 'gelembung_thinking_mode'  // ← NEW

const DEFAULT_SETTINGS = { temperature: 0.6, top_p: 0.95 }

function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { }
}

export const useMessagesStore = create((set, get) => ({
  // ─── Auth ──────────────────────────────────────────
  apiKey: lsGet(LS_KEY, ''),
  setApiKey: (key) => { lsSet(LS_KEY, key); set({ apiKey: key }) },

  logout: () => {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_MESSAGES)
    localStorage.removeItem(LS_SETTINGS)
    localStorage.removeItem(LS_THINKING_MODE)
    set({
      apiKey: '',
      messages: [],
      streaming: false,
      activeNode: null,
      elapsedMs: 0,
      streamStartTime: null,
      panelOpen: false,
      panelContent: null,
      attachments: [],
      settings: { ...DEFAULT_SETTINGS },
      thinkingMode: false,
    })
  },

  // ─── Settings ──────────────────────────────────────
  settings: lsGet(LS_SETTINGS, DEFAULT_SETTINGS),
  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch }
    lsSet(LS_SETTINGS, next)
    set({ settings: next })
  },

  // ─── Thinking Mode ─────────────────────────────────
  thinkingMode: lsGet(LS_THINKING_MODE, false),
  setThinkingMode: (val) => {
    lsSet(LS_THINKING_MODE, val)
    set({ thinkingMode: val })
  },

  // ─── Messages ──────────────────────────────────────
  messages: lsGet(LS_MESSAGES, []),
  streaming: false,
  activeNode: null,
  connected: true,
  streamStartTime: null,
  elapsedMs: 0,

  addMessage: (msg) =>
    set((s) => {
      const next = [...s.messages, msg]
      lsSet(LS_MESSAGES, next)
      return { messages: next }
    }),

  updateLastAssistant: (content, thinkingDuration, reasoningDetails) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content }
          if (thinkingDuration !== undefined) {
            msgs[i].thinkingDuration = thinkingDuration
          }
          if (reasoningDetails !== undefined) {
            msgs[i].reasoning_details = reasoningDetails
          }
          break
        }
      }
      lsSet(LS_MESSAGES, msgs)
      return { messages: msgs }
    }),

  updateMessageMeta: (node, elapsedMs, thinkingDuration) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], node, elapsedMs }
          // FIX: only save if actually positive (was thinking)
          // prevents saving 0 which breaks the "Thought for Xs" display after refresh
          if (typeof thinkingDuration === 'number' && thinkingDuration > 0) {
            msgs[i].thinkingDuration = thinkingDuration
          }
          break
        }
      }
      lsSet(LS_MESSAGES, msgs)
      return { messages: msgs }
    }),

  setStreaming: (val) =>
    set(() => ({
      streaming: val,
      streamStartTime: val ? Date.now() : null,
      elapsedMs: val ? 0 : get().elapsedMs,
    })),

  setActiveNode: (node) => set({ activeNode: node }),
  setConnection: (val) => set({ connected: val }),
  setElapsed: (ms) => set({ elapsedMs: ms }),

  getHistory: () => get().messages.map((m) => {
    if (m.role !== 'assistant') return m
    const out = { role: m.role, content: m.content }
    if (m.reasoning_details) out.reasoning_details = m.reasoning_details
    return out
  }),

  clearMessages: () => {
    lsSet(LS_MESSAGES, [])
    set({ messages: [], streaming: false, activeNode: null, elapsedMs: 0, streamStartTime: null })
  },

  // ─── Panel ─────────────────────────────────────────
  panelOpen: false,
  panelContent: null,
  openPanel: (content) => set({ panelOpen: true, panelContent: content }),
  closePanel: () => set({ panelOpen: false }),

  // ─── Attachments ───────────────────────────────────
  attachments: [],
  addAttachment: (file) => set((s) => ({ attachments: [...s.attachments, file] })),
  removeAttachment: (id) => set((s) => ({ attachments: s.attachments.filter((f) => f.id !== id) })),
  clearAttachments: () => set({ attachments: [] }),
}))