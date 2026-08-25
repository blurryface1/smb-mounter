import { mkdirSync } from 'fs'
import { basename, join, normalize } from 'path'
import { DEFAULT_MOUNT_PATH } from '../types'

const INCORRECT_SHARED_ROOT = '/User/Shared'
const SHARED_ROOT = '/Users/Shared'

export function normalizeMountPath(value: string): string {
  const mountPath = normalize(value.trim())
  if (mountPath === INCORRECT_SHARED_ROOT || mountPath.startsWith(`${INCORRECT_SHARED_ROOT}/`)) {
    return `${SHARED_ROOT}${mountPath.slice(INCORRECT_SHARED_ROOT.length)}`
  }

  return mountPath
}

export function ensureMountDirectory(value: string): string {
  const mountPath = normalizeMountPath(value)
  mkdirSync(mountPath, { recursive: true })
  return mountPath
}

export function getRecommendedMountPath(value: string): string {
  const name = basename(normalizeMountPath(value))
  return name ? join(DEFAULT_MOUNT_PATH, name) : DEFAULT_MOUNT_PATH
}
