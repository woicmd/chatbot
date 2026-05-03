import { useMessagesStore } from '../store/messages.js'

const s = {
  panel: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '8px 28px',
    background: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
    fontSize: 12,
    color: 'var(--tx-2)',
    fontFamily: 'var(--font-sans)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    fontWeight: 500,
  },
  value: {
    color: 'var(--tx)',
    minWidth: '3ch',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
  },
  slider: {
    width: 100,
    accentColor: 'var(--tx-3)',
    cursor: 'pointer',
  },
  model: {
    fontSize: 11,
    color: 'var(--tx-3)',
    fontFamily: 'var(--font-mono)',
    marginLeft: 'auto',
  },
}

export function SettingsPanel() {
  const settings = useMessagesStore((s) => s.settings)
  const updateSettings = useMessagesStore((s) => s.updateSettings)

  return (
    <div style={s.panel}>
      <label style={s.label}>
        Temperature
        <span style={s.value}>{settings.temperature.toFixed(2)}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: +e.target.value })}
          style={s.slider}
        />
      </label>

      <label style={s.label}>
        Top-P
        <span style={s.value}>{settings.top_p.toFixed(2)}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.top_p}
          onChange={(e) => updateSettings({ top_p: +e.target.value })}
          style={s.slider}
        />
      </label>

      <span style={s.model}>
        qwen/qwen3.5-122b-a10b
      </span>
    </div>
  )
}
