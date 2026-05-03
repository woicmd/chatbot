const s = {
  wrap: {
    padding: '20px',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    padding: '12px 16px',
    background: 'var(--bg-raised)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  icon: {
    fontSize: 24,
    color: 'var(--tx-3)',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--tx)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  size: {
    fontSize: 11,
    color: 'var(--tx-3)',
    marginTop: 2,
  },
  imageWrap: {
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    background: 'var(--bg-raised)',
  },
  image: {
    width: '100%',
    display: 'block',
  },
  textContent: {
    padding: '16px',
    background: 'var(--bg-raised)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: 13,
    lineHeight: 1.7,
    fontFamily: 'var(--font-mono)',
    color: 'var(--tx)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowX: 'auto',
    maxHeight: '60vh',
    overflowY: 'auto',
  },
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(type) {
  const isImage = type?.startsWith('image/')
  const isText = type?.includes('javascript') || type?.includes('python') || type?.includes('text') || type?.includes('json') || type?.includes('markdown')
  
  if (isImage) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    )
  }
  
  if (isText) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    )
  }
  
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  )
}

export function FilePreview({ file }) {
  if (!file) return null

  const isImage = file.type?.startsWith('image/') || file.contentType?.startsWith('image/')
  const isText = !isImage

  return (
    <div style={s.wrap}>
      {/* File meta info */}
      <div style={s.meta}>
        <span style={s.icon}>{getFileIcon(file.type || file.contentType)}</span>
        <div style={s.info}>
          <div style={s.name}>{file.filename || file.name || 'Untitled'}</div>
          {file.size && <div style={s.size}>{formatSize(file.size)}</div>}
        </div>
      </div>

      {/* Image preview */}
      {isImage && file.dataUrl && (
        <div style={s.imageWrap}>
          <img
            src={file.dataUrl}
            alt={file.filename || file.name}
            style={s.image}
          />
        </div>
      )}

      {/* Text content preview */}
      {isText && file.content && (
        <pre style={s.textContent}>{file.content}</pre>
      )}
    </div>
  )
}
