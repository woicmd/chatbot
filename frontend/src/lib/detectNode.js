const PATTERNS = [
  { re: /^\[Refactorer\]/i,        node: 'refactorer' },
  { re: /^\[AgentRx\]/i,           node: 'debugger'   },
  { re: /^\[Architect\]/i,         node: 'architect'  },
  { re: /^\[Explainer\]/i,         node: 'explainer'  },
  { re: /^\[Debugger Error\]/i,    node: 'error'      },
  { re: /^\[Evaluator Error\]/i,   node: 'error'      },
]

export function detectNode(text) {
  for (const { re, node } of PATTERNS) {
    if (re.test(text.trimStart())) return node
  }
  return 'respond'
}

// Returns ordered node names for the breadcrumb trace
export function getTrace(node) {
  const map = {
    respond:    ['router', 'respond'],
    explainer:  ['router', 'explainer'],
    refactorer: ['router', 'refactorer', 'evaluator'],
    debugger:   ['router', 'debugger', 'sandbox', 'evaluator'],
    architect:  ['router', 'architect'],
    error:      ['router', 'error'],
  }
  return map[node] ?? map.respond
}