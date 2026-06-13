import test from 'node:test'
import assert from 'node:assert/strict'
import {
  truncatePath,

  getMountSummary,
  getPrimaryMountAction,
  getMountDetailParts
} from '../out-test/renderer/ui/mountPresentation.js'

const baseMount = {
  id: 'share-1',
  name: 'UNRAID',
  server: 'FNNAS.local',
  shareName: 'UNRAID',
  username: 'alice',
  mountPath: '/Users/Shared/SMB/UNRAID',
  autoMount: false,
  autoRetry: false,
  retryInterval: 30
}

test('getMountSummary counts mounted, error, and auto retry shares', () => {
  const mounts = [
    { ...baseMount, id: 'share-1', autoRetry: true },
    { ...baseMount, id: 'share-2', autoRetry: false },
    { ...baseMount, id: 'share-3', autoRetry: true }
  ]
  const statuses = [
    { configId: 'share-1', status: 'mounted', lastChecked: 1, retryCount: 0 },
    { configId: 'share-2', status: 'error', lastChecked: 1, retryCount: 1, errorMessage: 'Cannot reach server' },
    { configId: 'share-3', status: 'disconnected', lastChecked: 1, retryCount: 0 }
  ]

  assert.deepEqual(getMountSummary(mounts, statuses), {
    total: 3,
    mounted: 1,
    errors: 1,
    autoRetry: 2
  })
})

test('getPrimaryMountAction opens Finder for mounted shares', () => {
  assert.equal(getPrimaryMountAction('mounted'), 'openInFinder')
})

test('getPrimaryMountAction retries error shares', () => {
  assert.equal(getPrimaryMountAction('error'), 'retry')
})

test('getPrimaryMountAction mounts disconnected and pending shares', () => {
  assert.equal(getPrimaryMountAction('disconnected'), 'mount')
  assert.equal(getPrimaryMountAction('pending'), 'mount')
})

test('getMountDetailParts includes share target and automation labels', () => {
  assert.deepEqual(
    getMountDetailParts({
      ...baseMount,
      autoMount: true,
      autoRetry: true
    }),
    [
      'FNNAS.local/UNRAID',
      '/Users/Shared/SMB/UNRAID',
      'Auto-mount',
      'Auto-retry'
    ]
  )
})


test('truncatePath shortens long paths by omitting middle segments', () => {
  // Short paths stay unchanged
  assert.equal(truncatePath('/Users/Shared/SMB/UNRAID'), '/Users/Shared/SMB/UNRAID')
  // Long paths truncate middle, keep first two and last two segments
  assert.equal(
    truncatePath('/Users/Shared/SMB/Projects/2026/Project-Archive/Old/Versions/Alpha'),
    '/Users/Shared/.../Versions/Alpha'
  )
  // Path with many segments truncates to keep first two and last two
  assert.equal(
    truncatePath('/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p'),
    '/a/b/.../o/p'
  )
  // Path with trailing slash is normalized before truncation
  assert.equal(truncatePath('/Users/Shared/SMB/UNRAID/'), '/Users/Shared/SMB/UNRAID')
  // Root path stays unchanged
  assert.equal(truncatePath('/'), '/')
})
