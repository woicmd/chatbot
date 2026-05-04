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
  divider: {
    width: 1,
    height: 16,
    background: 'var(--border)',
    flexShrink: 0,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  track: (on) => ({
    width: 32,
    height: 18,
    borderRadius: 9,
    background: on ? 'var(--ok)' : 'var(--border-hi)',
    position: 'relative',
    transition: 'background 0.2s',
    flexShrink: 0,
  }),
  thumb: (on) => ({
    position: 'absolute',
    top: 2,
    left: on ? 14 : 2,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: on ? '#fff' : 'var(--tx-2)',
    transition: 'left 0.2s, background 0.2s',
  }),
  toggleLabel: (on) => ({
    fontSize: 12,
    fontWeight: 500,
    color: on ? 'var(--ok)' : 'var(--tx-3)',
    fontFamily: 'var(--font-sans)',
    transition: 'color 0.2s',
    userSelect: 'none',
  }),
  modelBadge: {
    fontSize: 11,
    color: 'var(--tx-4)',
    fontFamily: 'var(--font-mono)',
    marginLeft: 'auto',
    letterSpacing: '0.02em',
  },
}

function Toggle({ on, onChange }) {
  return (
    <div style={s.track(on)} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <div style={s.thumb(on)} />
    </div>
  )
}

export function SettingsPanel() {
  const settings       = useMessagesStore((s) => s.settings)
  const updateSettings = useMessagesStore((s) => s.updateSettings)
  const thinkingMode   = useMessagesStore((s) => s.thinkingMode)
  const setThinkingMode = useMessagesStore((s) => s.setThinkingMode)

  return (
    <div style={s.panel}>
      <label style={s.label}>
        Temperature
        <span style={s.value}>{settings.temperature.toFixed(2)}</span>
        <input
          type="range" min="0" max="1" step="0.05"
          value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: +e.target.value })}
          style={s.slider}
        />
      </label>

      <label style={s.label}>
        Top-P
        <span style={s.value}>{settings.top_p.toFixed(2)}</span>
        <input
          type="range" min="0" max="1" step="0.05"
          value={settings.top_p}
          onChange={(e) => updateSettings({ top_p: +e.target.value })}
          style={s.slider}
        />
      </label>

      <div style={s.divider} />

      {/* Thinking Mode Toggle */}
      <div
        style={s.toggleRow}
        onClick={() => setThinkingMode(!thinkingMode)}
        title={thinkingMode ? 'Using reasoning model for chat' : 'Using fast model for chat'}
      >
        <Toggle on={thinkingMode} onChange={setThinkingMode} />
        <span style={s.toggleLabel(thinkingMode)}>
          {thinkingMode ? 'Thinking' : 'Standard'}
        </span>
      </div>

      <span style={s.modelBadge}>
        {thinkingMode ? 'reasoning model' : 'fast model'}
      </span>
    </div>
  )
}