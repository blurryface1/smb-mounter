export interface SystemMountLike {
  server: string
  shareName: string
  username: string
  mountPath: string
}

export function normalizeSelectedPath(path: string): string {
  if (path === '/') {
    return path
  }

  return path.replace(/\/+$/, '') || '/'
}

function isPathWithinMount(mountPath: string, selectedPath: string): boolean {
  if (mountPath === '/') {
    return selectedPath === '/' || selectedPath.startsWith('/')
  }

  return selectedPath === mountPath || selectedPath.startsWith(`${mountPath}/`)
}

export function findMountForSelectedPath<T extends SystemMountLike>(
  mounts: T[],
  selectedPath: string
): T | null {
  const normalizedSelectedPath = normalizeSelectedPath(selectedPath)
  let bestMatch: T | null = null
  let bestMatchLength = -1

  for (const mount of mounts) {
    const normalizedMountPath = normalizeSelectedPath(mount.mountPath)

    if (
      normalizedMountPath.length > bestMatchLength &&
      isPathWithinMount(normalizedMountPath, normalizedSelectedPath)
    ) {
      bestMatch = mount
      bestMatchLength = normalizedMountPath.length
    }
  }

  return bestMatch
}
