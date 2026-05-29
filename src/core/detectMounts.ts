// src/core/detectMounts.ts
import { execFileSync } from 'child_process'
import { parseSMBMountLine, safeDecodeURIComponent } from './smb'
import { dedupeDetectedMounts } from './mountIdentity'

export interface DetectedMount {
  server: string
  shareName: string
  username: string
  mountPath: string
}

export function detectSystemSMBMounts(): DetectedMount[] {
  try {
    const output = execFileSync('mount', [], { encoding: 'utf-8' })
    const lines = output.trim().split('\n').filter(line => line.includes('(smbfs'))
    const mounts: DetectedMount[] = []

    for (const line of lines) {
      const sourceEnd = line.indexOf(' on ')
      const source = sourceEnd === -1 ? '' : line.slice(0, sourceEnd)
      const sourceMatch = source.match(/^\/\/(.+)@([^/]+)\/(.+)$/)
      const parsed = parseSMBMountLine(line)

      if (sourceMatch && parsed) {
        const [, username, server, shareName] = sourceMatch
        mounts.push({
          username: safeDecodeURIComponent(username),
          server,
          shareName: safeDecodeURIComponent(shareName),
          mountPath: parsed.path
        })
      }
    }

    return dedupeDetectedMounts(mounts)
  } catch {
    return []
  }
}
