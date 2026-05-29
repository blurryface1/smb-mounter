export interface MountIdentity {
  server: string
  shareName: string
  username: string
}

export interface MountIdentityWithPath extends MountIdentity {
  mountPath: string
}

const MANAGED_MOUNT_PREFIX = '/System/Volumes/Data/mnt/SMB/'

function normalizeIdentityPart(value: string): string {
  return value.trim().toLowerCase()
}

export function getMountIdentityKey(mount: MountIdentity): string {
  return [
    normalizeIdentityPart(mount.server),
    normalizeIdentityPart(mount.shareName),
    normalizeIdentityPart(mount.username)
  ].join('/')
}

export function isSameMountIdentity(a: MountIdentity, b: MountIdentity): boolean {
  return getMountIdentityKey(a) === getMountIdentityKey(b)
}

function isManagedMountPath(mountPath: string): boolean {
  return mountPath.startsWith(MANAGED_MOUNT_PREFIX)
}

function shouldPreferDetectedMount(candidate: MountIdentityWithPath, existing: MountIdentityWithPath): boolean {
  const candidateManaged = isManagedMountPath(candidate.mountPath)
  const existingManaged = isManagedMountPath(existing.mountPath)

  if (candidateManaged !== existingManaged) {
    return candidateManaged
  }

  return candidate.mountPath < existing.mountPath
}

export function dedupeDetectedMounts<T extends MountIdentityWithPath>(mounts: T[]): T[] {
  const deduped = new Map<string, T>()

  for (const mount of mounts) {
    const key = getMountIdentityKey(mount)
    const existing = deduped.get(key)

    if (!existing || shouldPreferDetectedMount(mount, existing)) {
      deduped.set(key, mount)
    }
  }

  return Array.from(deduped.values())
}
