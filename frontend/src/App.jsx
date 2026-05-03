import { useState, useCallback } from 'react'
import { useMessagesStore } from './store/messages.js'
import { Header } from './components/Header.jsx'
import { SettingsPanel } from './components/SettingsPanel.jsx'
import { MessageList } from './components/MessageList.jsx'
import { ChatInput } from './components/ChatInput.jsx'
import { SidePanel } from './components/SidePanel.jsx'
import { KeyScreen } from './components/KeyScreen.jsx'
import { useSSE } from './hooks/useSSE.js'

const s = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '100vh',
    background: 'var(--bg-deep)',
  },
}

export default function App() {
  const apiKey = useMessagesStore((s) => s.apiKey)
  const setApiKey = useMessagesStore((s) => s.setApiKey)
  const streaming = useMessagesStore((s) => s.streaming)
  const { send, stop } = useSSE()
  const [showSettings, setShowSettings] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const handleSuggestionClick = useCallback((prompt) => {
    setInputValue(prompt)
    setTimeout(() => {
      const el = document.getElementById('chat-input')
      if (el) {
        el.focus()
        el.setSelectionRange(prompt.length, prompt.length)
      }
    }, 50)
  }, [])

  // ── Gate: no API key → show login screen ───────────
  if (!apiKey) {
    return <KeyScreen onKey={(key) => setApiKey(key)} />
  }

  return (
    <div style={s.app}>
      <Header
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((v) => !v)}
      />
      {showSettings && <SettingsPanel />}
      <MessageList onSuggestionClick={handleSuggestionClick} />
      <ChatInput
        onSend={send}
        onStop={stop}
        isStreaming={streaming}
        externalValue={inputValue}
        onExternalValueConsumed={() => setInputValue('')}
      />
      <SidePanel />
    </div>
  )
}
