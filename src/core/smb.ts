// src/core/smb.ts
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'

const execAsync = promisify(exec)

export interface MountResult {
  success: boolean
  error?: string
}

export async function checkServerReachable(server: string): Promise<boolean> {
  try {
    await execAsync(`ping -c 1 -W 2 ${server}`)
    return true
  } catch {
    return false
  }
}

export async function flushDNS(): Promise<void> {
  try {
    await execAsync('dscacheutil -flushcache')
    await execAsync('killall -HUP mDNSResponder')
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
    const smbUrl = `//${encodeURIComponent(username)}:${encodeURIComponent(password)}@${server}/${shareName}`

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
    const { stdout } = await execAsync('mount | grep smbfs')
    const mounts = new Map<string, string>()

    stdout.trim().split('\n').forEach(line => {
      // Format: //user@server/share on /path (smbfs, ...)
      const match = line.match(/^\/\/[^@]+@([^/]+)\/(\S+)\s+on\s+(\S+)\s+/)
      if (match) {
        const [, server, share, path] = match
        mounts.set(path, `${server}/${share}`)
      }
    })

    return mounts
  } catch {
    return new Map()
  }
}

export async function isMountActive(mountPath: string): Promise<boolean> {
  const mounts = await getMountedShares()
  return mounts.has(mountPath)
}