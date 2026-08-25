// src/core/smb.ts
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { MountIdentity, isSameMountIdentity } from './mountIdentity'
import { diagnosticLog, DiagnosticLogLevel } from './diagnosticLogger'
import { ensureMountDirectory, getRecommendedMountPath, normalizeMountPath } from './mountPath'

const execFileAsync = promisify(execFile)
const SYSTEM_SMB_AUTOMOUNT_ROOT = '/System/Volumes/Data/mnt/SMB'
const EXPECT_PATH = '/usr/bin/expect'
const MOUNT_SMBFS_PATH = '/sbin/mount_smbfs'
const UMOUNT_PATH = '/sbin/umount'
const DEFAULT_COMMAND_TIMEOUT_MS = 15000
const STATUS_COMMAND_TIMEOUT_MS = 5000
const EXPECT_COMMAND_ENV = 'SMB_MOUNTER_COMMAND'
const EXPECT_ARG_COUNT_ENV = 'SMB_MOUNTER_ARG_COUNT'
const EXPECT_ARG_ENV_PREFIX = 'SMB_MOUNTER_ARG_'
const EXPECT_SCRIPT = `
log_user 0
set timeout -1
set password ""
set command [list $env(${EXPECT_COMMAND_ENV})]
set argumentCount $env(${EXPECT_ARG_COUNT_ENV})
for {set index 0} {$index < $argumentCount} {incr index} {
  set argumentKey "${EXPECT_ARG_ENV_PREFIX}$index"
  lappend command $env($argumentKey)
}
spawn -noecho {*}$command
expect {
  -re {Password for [^\\r\\n]*:} {
    if {[gets stdin password] < 0} { exit 2 }
    send -- "$password\\r"
    exp_continue
  }
  eof {
    set output $expect_out(buffer)
    if {$password ne ""} {
      set output [string map [list $password "***"] $output]
    }
    send_user -- $output
  }
}
set result [wait]
exit [lindex $result 3]
`

export interface MountResult {
  success: boolean
  error?: string
}

export interface NativeCommandResult extends MountResult {
  output: string
}

export interface MountedSMBShare extends MountIdentity {
  mountPath: string
  target: string
}

type CommandRunner = (command: string, args: string[]) => Promise<void>
type DiagnosticLogRunner = (level: DiagnosticLogLevel, event: string, metadata?: Record<string, unknown>) => Promise<void>

interface SystemAutomountTriggerOptions {
  run?: CommandRunner
  isActive?: () => Promise<boolean>
  wait?: (ms: number) => Promise<void>
  attempts?: number
  openInFinder?: boolean
  finderTarget?: string
  log?: DiagnosticLogRunner
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

async function waitForActiveMount(
  isActive: () => Promise<boolean>,
  waitForRetry: (ms: number) => Promise<void>,
  attempts: number,
  log: DiagnosticLogRunner,
  metadata: Record<string, unknown>
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isActive()) {
      await log('info', 'systemAutomount.wait.active', { ...metadata, attempt: attempt + 1 })
      return true
    }

    await waitForRetry(500)
  }

  await log('warn', 'systemAutomount.wait.timeout', { ...metadata, attempts })
  return false
}

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function redactSMBUrlPassword(message: string): string {
  return message.replace(/\/\/([^:@/\s]+):([^@/\s]+)@/g, '//$1:***@')
}

function redactCredential(message: string, password: string): string {
  const redactedUrl = redactSMBUrlPassword(message)
  return password ? redactedUrl.split(password).join('***') : redactedUrl
}

interface ManagedCommandOptions {
  password?: string
  timeoutMs?: number
}

export interface SMBCommandOptions {
  timeoutMs?: number
}

function createCredentialEnvironment(command: string, args: string[]): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    [EXPECT_COMMAND_ENV]: command,
    [EXPECT_ARG_COUNT_ENV]: String(args.length)
  }
  args.forEach((arg, index) => {
    environment[`${EXPECT_ARG_ENV_PREFIX}${index}`] = arg
  })
  return environment
}

function runManagedCommand(
  command: string,
  args: string[],
  options: ManagedCommandOptions = {}
): Promise<NativeCommandResult> {
  return new Promise((resolve) => {
    const password = options.password ?? ''
    const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS
    const executable = password ? EXPECT_PATH : command
    const processArgs = password ? ['-N', '-n', '-c', EXPECT_SCRIPT] : args
    const proc = spawn(executable, processArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: password ? createCredentialEnvironment(command, args) : undefined
    })
    let output = ''
    let settled = false

    const finish = (result: MountResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      resolve({ ...result, output })
    }
    const collectOutput = (data: Buffer | string): void => {
      output += data.toString()
    }
    const timeoutId = setTimeout(() => {
      proc.kill()
      finish({ success: false, error: `Command timed out after ${timeoutMs} ms` })
    }, timeoutMs)

    proc.stdout?.on('data', collectOutput)
    proc.stderr?.on('data', collectOutput)
    if (password) {
      proc.stdin?.write(`${password}\n`)
      proc.stdin?.end()
    }
    proc.on('close', (code) => {
      if (code === 0) {
        finish({ success: true })
        return
      }
      const error = output.trim() || `${command} exited with code ${code}`
      finish({ success: false, error: redactCredential(error, password) })
    })
    proc.on('error', (error) => {
      finish({ success: false, error: redactCredential(error.message, password) })
    })
  })
}

export function runCredentialCommand(
  command: string,
  args: string[],
  password: string,
  timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS
): Promise<NativeCommandResult> {
  return runManagedCommand(command, args, { password, timeoutMs })
}

function toMountResult(result: NativeCommandResult): MountResult {
  return result.success
    ? { success: true }
    : { success: false, error: result.error }
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
  const log = options.log ?? diagnosticLog
  const metadata = { mountPath }
  const finderTarget = options.finderTarget ?? mountPath

  try {
    await log('info', 'systemAutomount.trigger.ls', metadata)
    await run('/bin/ls', [mountPath])
    if (await waitForActiveMount(isActive, waitForRetry, attempts, log, metadata)) {
      return true
    }
  } catch (error: any) {
    await log('warn', 'systemAutomount.trigger.ls', {
      ...metadata,
      error: error?.message ?? String(error)
    })
    // Finder is the most reliable trigger for macOS autofs SMB paths.
  }

  if (!options.openInFinder) {
    return false
  }

  try {
    await log('info', 'systemAutomount.trigger.openFinder', {
      ...metadata,
      finderTarget
    })
    await run('/usr/bin/open', [finderTarget])
  } catch (error: any) {
    await log('warn', 'systemAutomount.trigger.openFinder', {
      ...metadata,
      finderTarget,
      error: error?.message ?? String(error)
    })
    return false
  }

  return waitForActiveMount(isActive, waitForRetry, attempts, log, metadata)
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
  const normalizedMountPath = normalizeMountPath(mountPath)
  if (!existsSync(normalizedMountPath)) {
    try {
      ensureMountDirectory(normalizedMountPath)
    } catch (err: any) {
      const recommendedPath = getRecommendedMountPath(normalizedMountPath)
      return {
        success: false,
        error: `Failed to create mount directory: ${err.message}. Choose a writable path such as ${recommendedPath}`
      }
    }
  }

  const smbUrl = `//${encodeURIComponent(username)}@${server}/${encodeURIComponent(shareName)}`
  return toMountResult(await runCredentialCommand(MOUNT_SMBFS_PATH, [smbUrl, normalizedMountPath], password))
}

export async function unmountSMB(
  mountPath: string,
  options: SMBCommandOptions = {}
): Promise<MountResult> {
  return toMountResult(await runManagedCommand(UMOUNT_PATH, [mountPath], options))
}

export async function getMountedShares(): Promise<Map<string, string>> {
  try {
    const { stdout } = await execFileAsync('mount', [], { timeout: STATUS_COMMAND_TIMEOUT_MS })
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
    const { stdout } = await execFileAsync('mount', [], { timeout: STATUS_COMMAND_TIMEOUT_MS })

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
