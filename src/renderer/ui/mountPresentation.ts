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
}

const defaultMountDetailLabels: MountDetailLabels = {
  autoMount: 'Auto-mount',
  autoRetry: 'Auto-retry'
}

/**
 * Truncates long path by omitting middle segments, keeping first and last parts
 * Preserves root path, normalizes trailing slashes before truncation
 */
export function truncatePath(path: string): string {
  const normalized = path.replace(/\/+$/, "") || "/";
  if (normalized === "/") return "/";

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length <= 4) return normalized;

  const first = segments.slice(0, 2).join("/");
  const last = segments.slice(-2).join("/");
  return `/${first}/.../${last}`;
}

export function getMountDetailParts(
  mount: MountSummaryInput,
  labels: MountDetailLabels = defaultMountDetailLabels
): string[] {
  const parts = [
    `${mount.server}/${mount.shareName}`,
    mount.mountPath
  ]

  if (mount.autoMount) {
    parts.push(labels.autoMount)
  }

  if (mount.autoRetry) {
    parts.push(labels.autoRetry)
  }

  return parts
}
