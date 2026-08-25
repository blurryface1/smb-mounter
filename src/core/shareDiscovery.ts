import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { runCredentialCommand } from './smb'

export interface DiscoveredSMBServer {
  name: string
  serviceName: string
  host?: string
}

export interface SMBServerDiscoveryOptions {
  browse?: () => Promise<string>
  resolve?: (serviceName: string) => Promise<string | null>
  timeoutMs?: number
  resolveTimeoutMs?: number
}

export interface SMBSharesRequest {
  server: string
  username: string
  password: string
}

export interface DiscoveredSMBShare {
  shareName: string
  isHidden: boolean
  isAdministrative: boolean
}

export interface SMBShareListOptions extends SMBSharesRequest {
  includeHidden?: boolean
  view?: (request: SMBSharesRequest) => Promise<string>
  timeoutMs?: number
}

const execFileAsync = promisify(execFile)
const DEFAULT_BROWSE_TIMEOUT_MS = 1500
const DEFAULT_RESOLVE_TIMEOUT_MS = 1000
const DEFAULT_SHARE_LIST_TIMEOUT_MS = 15000

function runTimedBrowse(timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('dns-sd', ['-B', '_smb._tcp', 'local'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let finished = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (error?: Error) => {
      if (finished) {
        return
      }

      finished = true
      if (typeof timer !== 'undefined') {
        clearTimeout(timer)
      }

      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    }

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('error', (error) => {
      finish(error)
    })

    proc.on('close', (code, signal) => {
      if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM' || signal === null) {
        if (typeof code === 'number' && code !== 0 && signal === null) {
          finish(new Error(stderr || `dns-sd exited with code ${code}`))
          return
        }
        finish()
        return
      }

      finish(new Error(stderr || `dns-sd exited with code ${code}`))
    })

    timer = setTimeout(() => {
      proc.kill('SIGINT')
    }, timeoutMs)
  })
}

async function runNativeBrowse(timeoutMs: number): Promise<string> {
  return runTimedBrowse(timeoutMs)
}

function parseResolveOutput(output: string): string | null {
  const match = output.match(/can be reached at\s+(.+?):\d+/)
  if (!match) {
    return null
  }

  return match[1].trim().replace(/\.$/, '')
}

async function runNativeResolve(serviceName: string, timeoutMs: number): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('dns-sd', ['-L', serviceName, '_smb._tcp', 'local'], {
      timeout: timeoutMs
    })
    return parseResolveOutput(stdout)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'stdout' in error &&
      typeof error.stdout === 'string'
    ) {
      return parseResolveOutput(error.stdout)
    }

    return null
  }
}

async function runNativeShareList(request: SMBSharesRequest, timeoutMs: number): Promise<string> {
  const target = `//${encodeURIComponent(request.username)}@${request.server}`
  const result = await runCredentialCommand(
    '/usr/bin/smbutil',
    ['view', target],
    request.password,
    timeoutMs
  )

  if (!result.success) {
    throw new Error('Failed to list SMB shares')
  }

  return result.output
}

function parseBrowseLine(line: string): DiscoveredSMBServer | null {
  const match = line.match(/\s+_smb\._tcp\.\s+(.+)$/)
  if (!match) {
    return null
  }

  const serviceName = match[1].trim()
  if (!serviceName) {
    return null
  }

  return {
    name: serviceName,
    serviceName
  }
}

function isAdministrativeShare(name: string): boolean {
  const upperName = name.toUpperCase()
  return upperName === 'IPC$' || upperName === 'ADMIN$'
}

function isHiddenShare(name: string): boolean {
  return isAdministrativeShare(name) || name.endsWith('$')
}

function parseShareLine(line: string, includeHidden: boolean): DiscoveredSMBShare | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('-') || trimmed.startsWith('Share ')) {
    return null
  }

  const match = trimmed.match(/^(.+?)\s+(Disk|Pipe)(?:\s|$)/)
  if (!match) {
    return null
  }

  const [, namePart, type] = match
  const name = namePart.trim()
  if (!name || (type !== 'Disk' && type !== 'Pipe')) {
    return null
  }

  const isHidden = isHiddenShare(name)
  if (isHidden && !includeHidden) {
    return null
  }

  return {
    shareName: name,
    isHidden,
    isAdministrative: isAdministrativeShare(name)
  }
}

export async function discoverSMBServers(options: SMBServerDiscoveryOptions = {}): Promise<DiscoveredSMBServer[]> {
  const output = options.browse
    ? await options.browse()
    : await runNativeBrowse(options.timeoutMs ?? DEFAULT_BROWSE_TIMEOUT_MS)
  const resolve = options.resolve
    ?? (options.browse
      ? undefined
      : ((serviceName: string) => runNativeResolve(serviceName, options.resolveTimeoutMs ?? DEFAULT_RESOLVE_TIMEOUT_MS)))
  const servers = new Map<string, DiscoveredSMBServer>()

  for (const line of output.split('\n')) {
    const server = parseBrowseLine(line)
    if (server && !servers.has(server.serviceName)) {
      servers.set(server.serviceName, server)
    }
  }

  if (resolve) {
    await Promise.all(Array.from(servers.values()).map(async server => {
      const host = await resolve(server.serviceName)
      if (host) server.host = host
    }))
  }

  return Array.from(servers.values())
}

export async function listSMBShares(options: SMBShareListOptions): Promise<DiscoveredSMBShare[]> {
  const request = {
    server: options.server,
    username: options.username,
    password: options.password
  }
  const output = options.view
    ? await options.view(request)
    : await runNativeShareList(request, options.timeoutMs ?? DEFAULT_SHARE_LIST_TIMEOUT_MS)
  const shares: DiscoveredSMBShare[] = []

  for (const line of output.split('\n')) {
    const share = parseShareLine(line, options.includeHidden === true)
    if (share) {
      shares.push(share)
    }
  }

  return shares
}
