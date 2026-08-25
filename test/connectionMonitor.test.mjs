import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import Module from 'node:module'

const require = createRequire(import.meta.url)

function createMount(id, overrides = {}) {
  return {
    id,
    name: id,
    server: 'nas.local',
    shareName: id,
    username: 'user',
    mountPath: `/Volumes/${id}`,
    autoMount: false,
    autoRetry: false,
    retryInterval: 30,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

function loadConnectionMonitorWithMocks({ mounts, statuses }) {
  const modulePath = require.resolve('../out-test/core/connectionMonitor.js')
  const originalLoad = Module._load
  const mountCalls = []
  const retryCalls = []
  const refreshCalls = {
    single: 0,
    all: 0
  }
  const mountManager = {
    refreshStatus: async (mount) => {
      refreshCalls.single += 1
      return statuses.get(mount.id)
    },
    refreshAllStatuses: async () => {
      refreshCalls.all += 1
      return Array.from(statuses.values())
    },
    mount: async (id, options) => {
      mountCalls.push({ id, options })
      return { success: true }
    },
    retryMount: async (id, options) => {
      retryCalls.push({ id, options })
      return { success: true }
    }
  }

  delete require.cache[modulePath]
  Module._load = (request, parent, isMain) => {
    if (request === './configStore') {
      return {
        getMounts: () => mounts,
        getSettings: () => ({ checkInterval: 30 })
      }
    }
    if (request === './mountManager') return { mountManager }
    if (request === './diagnosticLogger') return { diagnosticLog: async () => undefined }
    return originalLoad(request, parent, isMain)
  }

  try {
    return {
      connectionMonitor: require(modulePath).connectionMonitor,
      mountCalls,
      retryCalls,
      refreshCalls
    }
  } finally {
    Module._load = originalLoad
  }
}

test('starts by mounting disconnected shares with autoMount enabled', async () => {
  const autoMount = createMount('auto', { autoMount: true })
  const manual = createMount('manual')
  const statuses = new Map([
    ['auto', { configId: 'auto', status: 'disconnected', lastChecked: 1, retryCount: 0 }],
    ['manual', { configId: 'manual', status: 'disconnected', lastChecked: 1, retryCount: 0 }]
  ])
  const { connectionMonitor, mountCalls } = loadConnectionMonitorWithMocks({
    mounts: [autoMount, manual],
    statuses
  })

  try {
    await connectionMonitor.start()
  } finally {
    connectionMonitor.stop()
  }

  assert.deepEqual(mountCalls, [{
    id: 'auto',
    options: {
      source: 'autoMount',
      openSystemAutomountInFinder: false
    }
  }])
})

test('checks auto-mount candidates from one batched status refresh', async () => {
  const photos = createMount('photos', { autoMount: true })
  const backup = createMount('backup', { autoMount: true })
  const statuses = new Map([
    ['photos', { configId: 'photos', status: 'mounted', lastChecked: 1, retryCount: 0 }],
    ['backup', { configId: 'backup', status: 'mounted', lastChecked: 1, retryCount: 0 }]
  ])
  const { connectionMonitor, refreshCalls } = loadConnectionMonitorWithMocks({
    mounts: [photos, backup],
    statuses
  })

  await connectionMonitor.checkAndRemount()

  assert.deepEqual(refreshCalls, { single: 0, all: 1 })
})

test('keeps startup auto-mount and connection auto-retry semantics independent', async () => {
  const autoMount = createMount('auto-mount', { autoMount: true })
  const autoRetry = createMount('auto-retry', { autoRetry: true })
  const manual = createMount('manual')
  const statuses = new Map([autoMount, autoRetry, manual].map(mount => [
    mount.id,
    { configId: mount.id, status: 'disconnected', lastChecked: 1, retryCount: 0 }
  ]))
  const { connectionMonitor, mountCalls, retryCalls } = loadConnectionMonitorWithMocks({
    mounts: [autoMount, autoRetry, manual],
    statuses
  })

  try {
    await connectionMonitor.start()
  } finally {
    connectionMonitor.stop()
  }

  assert.deepEqual(mountCalls, [{
    id: autoMount.id,
    options: { source: 'autoMount', openSystemAutomountInFinder: false }
  }])
  assert.deepEqual(retryCalls, [{
    id: autoRetry.id,
    options: { source: 'autoRetry', openSystemAutomountInFinder: false }
  }])
})
