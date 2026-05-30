// src/core/smb.ts
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'
import { MountIdentity, isSameMountIdentity } from './mountIdentity'

const execFileAsync = promisify(execFile)
const SYSTEM_SMB_AUTOMOUNT_ROOT = '/System/Volumes/Data/mnt/SMB'

export interface MountResult {
  success: boolean
  error?: string
}

export interface MountedSMBShare extends MountIdentity {
  mountPath: string
  target: string
}

type CommandRunner = (command: string, args: string[]) => Promise<void>

interface SystemAutomountTriggerOptions {
  run?: CommandRunner
  isActive?: () => Promise<boolean>
  wait?: (ms: number) => Promise<void>
  attempts?: number
  openInFinder?: boolean
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'ignore']
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

async function runExecFile(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args, { timeout: 5000 })
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function isSystemAutomountPath(mountPath: string): boolean {
  const normalizedPath = mountPath.replace(/\/+$/, '')
  return normalizedPath.startsWith(`${SYSTEM_SMB_AUTOMOUNT_ROOT}/`)
}

export async function triggerSystemAutomount(
  mountPath: string,
  options: SystemAutomountTriggerOptions = {}
): Promise<boolean> {
  if (!isSystemAutomountPath(mountPath)) {
    return false
  }

  const run = options.run ?? runExecFile
  const isActive = options.isActive ?? (() => isExactMountPathActive(mountPath))
  const waitForRetry = options.wait ?? wait
  const attempts = options.attempts ?? 10

  try {
    await run('/bin/ls', [mountPath])
    return true
  } catch {
    // Finder is the most reliable trigger for macOS autofs SMB paths.
  }

  if (!options.openInFinder) {
    return false
  }

  try {
    await run('/usr/bin/open', [mountPath])
  } catch {
    return false
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isActive()) {
      return true
    }

    await waitForRetry(500)
  }

  return false
}

export function parseSMBMountLine(line: string): (MountedSMBShare & { path: string }) | null {
  const detailsStart = line.lastIndexOf(' (')
  if (detailsStart === -1) return null

  const mountExpression = line.slice(0, detailsStart)
  const separator = ' on '
  const separatorIndex = mountExpression.indexOf(separator)
  if (separatorIndex === -1) return null

  const source = mountExpression.slice(0, separatorIndex)
  const path = mountExpression.slice(separatorIndex + separator.length)
  const match = source.match(/^\/\/(.+)@([^/]+)\/(.+)$/)
  if (!match || !path) return null

  const [, encodedUsername, server, encodedShare] = match
  const shareName = safeDecodeURIComponent(encodedShare)
  return {
    path,
    mountPath: path,
    target: `${server}/${shareName}`,
    username: safeDecodeURIComponent(encodedUsername),
    server,
    shareName
  }
}

export async function checkServerReachable(server: string): Promise<boolean> {
  try {
    await runCommand('ping', ['-c', '1', '-W', '2', server])
    return true
  } catch {
    return false
  }
}

export async function flushDNS(): Promise<void> {
  try {
    await runCommand('dscacheutil', ['-flushcache'])
    await runCommand('killall', ['-HUP', 'mDNSResponder'])
  } catch {
    // Ignore errors
  }
}

export async function mountSMB(
  server: string,
  shareName: string,
  username: string,
  password: string,
  mountPath: string
): Promise<MountResult> {
  // Ensure mount directory exists
  if (!existsSync(mountPath)) {
    try {
      mkdirSync(mountPath, { recursive: true })
    } catch (err: any) {
      return { success: false, error: `Failed to create mount directory: ${err.message}` }
    }
  }

  return new Promise((resolve) => {
    const smbUrl = `//${encodeURIComponent(username)}:${encodeURIComponent(password)}@${server}/${encodeURIComponent(shareName)}`

    const proc = spawn('mount_smbfs', [smbUrl, mountPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({
          success: false,
          error: stderr || `mount_smbfs exited with code ${code}`
        })
      }
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

export async function unmountSMB(mountPath: string): Promise<MountResult> {
  return new Promise((resolve) => {
    const proc = spawn('umount', [mountPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({
          success: false,
          error: stderr || `umount exited with code ${code}`
        })
      }
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

export async function getMountedShares(): Promise<Map<string, string>> {
  try {
    const { stdout } = await execFileAsync('mount', [])
    const mounts = new Map<string, string>()

    stdout.trim().split('\n').filter(line => line.includes('(smbfs')).forEach(line => {
      const parsed = parseSMBMountLine(line)
      if (parsed) {
        mounts.set(parsed.path, parsed.target)
      }
    })

    return mounts
  } catch {
    return new Map()
  }
}

export async function getMountedSMBShares(): Promise<MountedSMBShare[]> {
  try {
    const { stdout } = await execFileAsync('mount', [])

    return stdout.trim().split('\n').filter(line => line.includes('(smbfs')).flatMap(line => {
      const parsed = parseSMBMountLine(line)
      return parsed ? [parsed] : []
    })
  } catch {
    return []
  }
}

export async function isMountActive(mountPath: string, identity?: MountIdentity): Promise<boolean> {
  if (!identity) {
    const mounts = await getMountedShares()
    return mounts.has(mountPath)
  }

  const mounts = await getMountedSMBShares()
  return mounts.some(mount => mount.mountPath === mountPath || isSameMountIdentity(mount, identity))
}

export async function isExactMountPathActive(mountPath: string): Promise<boolean> {
  const mounts = await getMountedShares()
  return mounts.has(mountPath)
}
