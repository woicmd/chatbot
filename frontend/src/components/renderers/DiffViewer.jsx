const s = {
  wrap: {
    margin: '12px 0',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  header: {
    padding: '8px 14px',
    fontSize: 12,
    color: 'var(--tx-2)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
  filePath: {
    color: 'var(--tx)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
  },
  cols: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  side: {
    padding: '14px 16px',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    lineHeight: 1.9,
    overflowX: 'auto',
  },
  before: {
    background: 'var(--err-bg)',
    borderRight: '1px solid var(--border)',
  },
  after: {
    background: 'var(--ok-bg)',
  },
  label: {
    fontSize: 10,
    letterSpacing: '0.08em',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  labelBefore: { color: 'var(--err)' },
  labelAfter:  { color: 'var(--ok)' },
}

function colorLine(line) {
  if (line.startsWith('-')) return 'var(--err)'
  if (line.startsWith('+')) return 'var(--ok)'
  return 'var(--tx-3)'
}

function renderLines(code, prefix) {
  return code.split('\n').map((line, i) => (
    <div key={i} style={{ color: colorLine(prefix + line) }}>
      {line || '\u00A0'}
    </div>
  ))
}

function DiffBlock({ block }) {
  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={{ color: 'var(--tx-3)' }}>◇</span>
        <span style={s.filePath}>{block.file_path}</span>
      </div>
      <div style={s.cols}>
        <div style={{ ...s.side, ...s.before }}>
          <div style={{ ...s.label, ...s.labelBefore }}>Before</div>
          {renderLines(block.before, '-')}
        </div>
        <div style={{ ...s.side, ...s.after }}>
          <div style={{ ...s.label, ...s.labelAfter }}>After</div>
          {renderLines(block.after, '+')}
        </div>
      </div>
    </div>
  )
}

export function DiffViewer({ blocks }) {
  return (
    <div>
      {blocks.map((b, i) => <DiffBlock key={i} block={b} />)}
    </div>
  )
}