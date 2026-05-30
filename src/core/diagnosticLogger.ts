import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export type DiagnosticLogLevel = 'info' | 'warn' | 'error'

export interface DiagnosticLoggerOptions {
  diagnosticMode: boolean
  baseDir?: string
  maxBytes?: number
}

export interface DiagnosticLogger {
  log: (level: DiagnosticLogLevel, event: string, metadata?: Record<string, unknown>) => Promise<void>
  getLogFilePath: () => string
  ensureLogFile: () => string
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024
const LOG_DIR_NAME = 'logs'
const LOG_FILE_NAME = 'app.log'
const ROTATED_LOG_FILE_NAME = 'app.log.1'
const CONFIG_FILE_NAME = 'config.json'
const OMITTED_SENSITIVE_KEYS = new Set(['password', 'encryptedpassword'])

function getDefaultBaseDir(): string {
  return join(homedir(), '.smb-mounter')
}

function getLogDir(baseDir: string): string {
  return join(baseDir, LOG_DIR_NAME)
}

function getLogFile(baseDir: string): string {
  return join(getLogDir(baseDir), LOG_FILE_NAME)
}

function getRotatedLogFile(baseDir: string): string {
  return join(getLogDir(baseDir), ROTATED_LOG_FILE_NAME)
}

function getConfigFile(baseDir: string): string {
  return join(baseDir, CONFIG_FILE_NAME)
}

function isDiagnosticModeEnabled(baseDir: string): boolean {
  const configFile = getConfigFile(baseDir)
  if (!existsSync(configFile)) {
    return false
  }

  try {
    const parsed = JSON.parse(readFileSync(configFile, 'utf-8')) as { settings?: { diagnosticMode?: unknown } }
    return parsed.settings?.diagnosticMode === true
  } catch {
    return false
  }
}

function ensureLogDir(baseDir: string): void {
  const logDir = getLogDir(baseDir)
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
}

function rotateIfNeeded(baseDir: string, maxBytes: number): void {
  const logFile = getLogFile(baseDir)
  if (!existsSync(logFile) || statSync(logFile).size <= maxBytes) {
    return
  }

  const rotatedLogFile = getRotatedLogFile(baseDir)
  if (existsSync(rotatedLogFile)) {
    rmSync(rotatedLogFile)
  }
  renameSync(logFile, rotatedLogFile)
}

function looksLikeCredentialUrl(value: string): boolean {
  return /^\/\/[^/@\s]+:[^/@\s]+@/.test(value) || /^[a-z]+:\/\/[^/@\s]+:[^/@\s]+@/i.test(value)
}

function redactValue(key: string, value: unknown): unknown {
  const normalizedKey = key.toLowerCase()
  if (OMITTED_SENSITIVE_KEYS.has(normalizedKey)) {
    return undefined
  }

  if (typeof value === 'string' && looksLikeCredentialUrl(value)) {
    return '[redacted]'
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item))
  }

  if (typeof value === 'object' && value !== null) {
    return redactRecord(value as Record<string, unknown>)
  }

  return value
}

function redactUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item))
  }

  if (typeof value === 'object' && value !== null) {
    return redactRecord(value as Record<string, unknown>)
  }

  return value
}

function redactRecord(metadata: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata)) {
    const nextValue = redactValue(key, value)
    if (typeof nextValue !== 'undefined') {
      redacted[key] = nextValue
    }
  }

  return redacted
}

export function createDiagnosticLogger(options: DiagnosticLoggerOptions): DiagnosticLogger {
  const baseDir = options.baseDir ?? getDefaultBaseDir()
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  return {
    getLogFilePath: () => getLogFile(baseDir),
    ensureLogFile: () => {
      ensureLogDir(baseDir)
      const logFile = getLogFile(baseDir)
      if (!existsSync(logFile)) {
        writeFileSync(logFile, '')
      }
      return logFile
    },
    log: async (level, event, metadata = {}) => {
      if (!options.diagnosticMode) {
        return
      }

      try {
        ensureLogDir(baseDir)
        rotateIfNeeded(baseDir, maxBytes)
        const entry = {
          ts: new Date().toISOString(),
          level,
          event,
          ...redactRecord(metadata)
        }
        appendFileSync(getLogFile(baseDir), `${JSON.stringify(entry)}\n`, 'utf-8')
      } catch (error) {
        console.error('Failed to write diagnostic log:', error)
      }
    }
  }
}

export function getDiagnosticLogFilePath(): string {
  return getLogFile(getDefaultBaseDir())
}

export async function diagnosticLog(
  level: DiagnosticLogLevel,
  event: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const baseDir = getDefaultBaseDir()
  await createDiagnosticLogger({
    diagnosticMode: isDiagnosticModeEnabled(baseDir),
    baseDir
  }).log(level, event, metadata)
}

export async function openDiagnosticLogFile(): Promise<{ success: boolean; error?: string }> {
  const logger = createDiagnosticLogger({ diagnosticMode: true })
  const logFile = logger.ensureLogFile()
  const electron = require('electron') as { shell?: { openPath: (path: string) => Promise<string> } }

  if (!electron.shell?.openPath) {
    return { success: false, error: 'Electron shell is not available' }
  }

  const error = await electron.shell.openPath(logFile)
  return error ? { success: false, error } : { success: true }
}
