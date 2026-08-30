/** Shared in-app navigation history for Back / Forward across all AppLayout pages. */

export type NavEntry = {
  path: string
  key: string
}

export type NavHistorySnapshot = {
  canBack: boolean
  canForward: boolean
  backPath: string | null
  forwardPath: string | null
  currentPath: string | null
}

let stack: NavEntry[] = []
let index = -1
const listeners = new Set<() => void>()

let cachedSnapshot: NavHistorySnapshot = {
  canBack: false,
  canForward: false,
  backPath: null,
  forwardPath: null,
  currentPath: null,
}

function rebuildSnapshot() {
  cachedSnapshot = {
    canBack: index > 0,
    canForward: index >= 0 && index < stack.length - 1,
    backPath: index > 0 ? stack[index - 1].path : null,
    forwardPath: index >= 0 && index < stack.length - 1 ? stack[index + 1].path : null,
    currentPath: index >= 0 ? stack[index].path : null,
  }
}

function notify() {
  rebuildSnapshot()
  listeners.forEach((fn) => fn())
}

export function subscribeNavHistory(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Stable snapshot reference until history actually changes (required by useSyncExternalStore). */
export function getNavHistorySnapshot() {
  return cachedSnapshot
}

/** Record a location change from React Router (Link clicks, redirects, etc.). */
export function recordNavLocation(path: string, key: string) {
  if (index >= 0 && stack[index]?.path === path) {
    if (stack[index].key === key) return
    stack[index] = { path, key }
    notify()
    return
  }

  // Moving forward onto an existing forward entry
  if (index >= 0 && index < stack.length - 1 && stack[index + 1]?.path === path) {
    index += 1
    stack[index] = { path, key }
    notify()
    return
  }

  // Moving back onto an existing prior entry
  if (index > 0 && stack[index - 1]?.path === path) {
    index -= 1
    stack[index] = { path, key }
    notify()
    return
  }

  stack = stack.slice(0, index + 1)
  stack.push({ path, key })
  index = stack.length - 1
  notify()
}

/** Step back in the shared stack; returns path to navigate to. */
export function stepNavBack(): string | null {
  if (index <= 0) return null
  index -= 1
  notify()
  return stack[index]?.path ?? null
}

/** Step forward in the shared stack; returns path to navigate to. */
export function stepNavForward(): string | null {
  if (index < 0 || index >= stack.length - 1) return null
  index += 1
  notify()
  return stack[index]?.path ?? null
}
