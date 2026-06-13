export type MountDisplayStatus = 'mounted' | 'disconnected' | 'error' | 'pending'

export interface MountSummaryInput {
  id: string
  server: string
  shareName: string
  mountPath: string
  autoMount: boolean
  autoRetry: boolean
}

export interface MountStatusInput {
  configId: string
  status: MountDisplayStatus
}

export interface MountSummary {
  total: number
  mounted: number
  errors: number
  autoRetry: number
}

export type PrimaryMountAction = 'openInFinder' | 'mount' | 'retry'

export function getMountSummary(
  mounts: MountSummaryInput[],
  statuses: MountStatusInput[]
): MountSummary {
  const statusById = new Map(statuses.map(status => [status.configId, status.status]))

  return mounts.reduce<MountSummary>((summary, mount) => {
    const status = statusById.get(mount.id) || 'disconnected'

    return {
      total: summary.total + 1,
      mounted: summary.mounted + (status === 'mounted' ? 1 : 0),
      errors: summary.errors + (status === 'error' ? 1 : 0),
      autoRetry: summary.autoRetry + (mount.autoRetry ? 1 : 0)
    }
  }, {
    total: 0,
    mounted: 0,
    errors: 0,
    autoRetry: 0
  })
}

export function getPrimaryMountAction(status: MountDisplayStatus): PrimaryMountAction {
  if (status === 'mounted') {
    return 'openInFinder'
  }

  if (status === 'error') {
    return 'retry'
  }

  return 'mount'
}

interface MountDetailLabels {
  autoMount: string
  autoRetry: string
  sharePrefix: string
  localMountPrefix: string
}

const defaultMountDetailLabels: MountDetailLabels = {
  autoMount: "Auto-mount",
  autoRetry: "Auto-retry",
  sharePrefix: "Share",
  localMountPrefix: "Local",
}

/**
 * Truncates long path by omitting middle segments, keeping first and last parts
 * Preserves root path, normalizes trailing slashes before truncation
 */
export function truncatePath(path: string): string {
  const normalized = path.replace(/\/+$/, "") || "/"
  if (normalized === "/") return "/"

  const segments = normalized.split("/").filter(Boolean)
  if (segments.length <= 4) return normalized

  const first = segments.slice(0, 2).join("/")
  const last = segments.slice(-2).join("/")
  return `/${first}/.../${last}`
}

/**
 * Formats long error messages into short summaries for list display
 * - Takes first sentence (up to first .,!?)\
 * - Takes first line if newlines exist\
 * - Truncates to max 120 characters with ellipsis if needed\
 */
export function formatErrorSummary(errorMessage: string): string {
  if (!errorMessage) return ""
  const firstLine = errorMessage.split("\n")[0].trim()
  const firstSentence = firstLine.match(/^[^.!?]+[.!?]?/)?.[0] || firstLine
  if (firstSentence.length <= 120) return firstSentence.trim()
  return `${firstSentence.slice(0, 117).trim()}...`
}

/**
 * Generates default share name based on existing mounts
 * - No conflicting names: use shareName directly
 * - Same shareName from different server: use "server · shareName"
 * - Editing existing same server+shareName: use shareName directly
 * - Automatically strips .local suffix from server name for cleaner display
 */
export function getMountDefaultName(
  server: string,
  shareName: string,
  existingMounts: MountSummaryInput[]
): string {
  const shareNameLower = shareName.toLowerCase()
  const serverLower = server.toLowerCase()

  // Check if this exact server+shareName already exists (editing scenario)
  const alreadyExists = existingMounts.some(
    mount => mount.shareName.toLowerCase() === shareNameLower && mount.server.toLowerCase() === serverLower
  )

  if (alreadyExists) {
    return shareName
  }

  // Check if any other server has the same shareName
  const hasConflictingName = existingMounts.some(
    mount => mount.shareName.toLowerCase() === shareNameLower && mount.server.toLowerCase() !== serverLower
  )

  if (!hasConflictingName) return shareName

  // Strip .local suffix for cleaner display
  const displayServer = server.replace(/\.local$/i, "")
  return `${displayServer} · ${shareName}`
}

export function getMountDetailParts(
  mount: MountSummaryInput,
  labels: Partial<MountDetailLabels> = defaultMountDetailLabels
): string[] {
  const mergedLabels = { ...defaultMountDetailLabels, ...labels }
  const parts = [
    `${mergedLabels.sharePrefix} ${mount.server}/${mount.shareName}`,
    `${mergedLabels.localMountPrefix} ${truncatePath(mount.mountPath)}`,
  ]

  if (mount.autoMount) {
    parts.push(mergedLabels.autoMount)
  }

  if (mount.autoRetry) {
    parts.push(mergedLabels.autoRetry)
  }

  return parts
}
