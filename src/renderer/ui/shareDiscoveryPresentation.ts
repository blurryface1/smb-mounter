import { getMountIdentityKey, MountIdentity } from '../../core/mountIdentity'

interface SavedMountInput extends MountIdentity {
  id: string
}

interface BuildDiscoveredShareOptionInput extends MountIdentity {
  savedMounts: SavedMountInput[]
}

export interface DiscoveredShareOption {
  server: string
  shareName: string
  alreadySaved: boolean
}

export function getGeneratedMountPath(defaultMountPath: string, shareName: string): string {
  const mountRoot = defaultMountPath === '/' ? '' : defaultMountPath.replace(/\/+$/, '')
  return `${mountRoot}/${shareName}`
}

export function buildDiscoveredShareOption(input: BuildDiscoveredShareOptionInput): DiscoveredShareOption {
  const existingKeys = new Set(input.savedMounts.map(mount => getMountIdentityKey(mount)))

  return {
    server: input.server,
    shareName: input.shareName,
    alreadySaved: existingKeys.has(getMountIdentityKey(input))
  }
}
