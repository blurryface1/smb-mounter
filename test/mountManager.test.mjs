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
    encryptedPassword: 'encrypted',
    ...overrides
  }
}

function loadMountManagerWithMocks(options) {
  const modulePath = require.resolve('../out-test/core/mountManager.js')
  const originalLoad = Module._load
  const notifications = []
  const calls = {
    mountedReads: 0,
    activeChecks: 0,
    mounts: 0,
    unmounts: 0,
    reachabilityChecks: 0
  }
  const mounts = options.mounts ?? []

  delete require.cache[modulePath]
  Module._load = (request, parent, isMain) => {
    if (request === 'electron') {
      return {
        Notification: class {
          constructor(notification) {
            this.notification = notification
          }

          show() {
            notifications.push(this.notification)
          }
        }
      }
    }
    if (request === './configStore') {
      return {
        getMounts: () => mounts,
        getMountById: (id) => mounts.find(mount => mount.id === id),
        getDecryptedPassword: () => 'secret',
        getSettings: () => ({ showNotifications: true })
      }
    }
    if (request === './smb') {
      return {
        mountSMB: async () => {
          calls.mounts += 1
          return options.mountResult ?? { success: true }
        },
        unmountSMB: async () => {
          calls.unmounts += 1
          return options.unmountResult ?? { success: true }
        },
        isMountActive: async () => {
          calls.activeChecks += 1
          return options.active ?? false
        },
        getMountedSMBShares: async () => {
          calls.mountedReads += 1
          return options.mountedShares ?? []
        },
        checkServerReachable: async () => {
          calls.reachabilityChecks += 1
          return options.reachable ?? false
        },
        flushDNS: async () => undefined,
        isSystemAutomountPath: () => false,
        triggerSystemAutomount: async () => false
      }
    }
    if (request === './diagnosticLogger') return { diagnosticLog: async () => undefined }
    return originalLoad(request, parent, isMain)
  }

  try {
    return {
      mountManager: require(modulePath).mountManager,
      calls,
      notifications
    }
  } finally {
    Module._load = originalLoad
  }
}

test('refreshes every saved mount from one system mount-table read', async () => {
  const photos = createMount('photos')
  const backup = createMount('backup')
  const { mountManager, calls } = loadMountManagerWithMocks({
    mounts: [photos, backup],
    mountedShares: [{
      server: photos.server,
      shareName: photos.shareName,
      username: photos.username,
      mountPath: photos.mountPath,
      target: `${photos.server}/${photos.shareName}`
    }]
  })

  const statuses = await mountManager.refreshAllStatuses()

  assert.equal(calls.mountedReads, 1)
  assert.equal(calls.activeChecks, 0)
  assert.deepEqual(statuses.map(status => [status.configId, status.status]), [
    ['photos', 'mounted'],
    ['backup', 'disconnected']
  ])
})

test('attempts SMB mount without requiring an ICMP reachability check', async () => {
  const photos = createMount('photos')
  const { mountManager, calls } = loadMountManagerWithMocks({
    mounts: [photos],
    reachable: false,
    mountResult: { success: true }
  })

  const result = await mountManager.mount(photos.id)

  assert.deepEqual(result, { success: true })
  assert.equal(calls.reachabilityChecks, 0)
  assert.equal(calls.mounts, 1)
})

test('shows a notification after an SMB share is unmounted', async () => {
  const photos = createMount('photos', { name: 'Photos' })
  const { mountManager, notifications } = loadMountManagerWithMocks({
    mounts: [photos],
    unmountResult: { success: true }
  })

  const result = await mountManager.unmount(photos.id)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(notifications, [{
    title: 'SMB Mounter',
    body: 'Photos unmounted successfully'
  }])
})

test('publishes live status changes to tray listeners', async () => {
  const photos = createMount('photos')
  const { mountManager } = loadMountManagerWithMocks({
    mounts: [photos],
    mountedShares: []
  })
  const events = []
  const unsubscribe = mountManager.onStatusesChanged(statuses => {
    events.push(statuses.map(status => [status.configId, status.status]))
  })

  await mountManager.refreshAllStatuses()
  unsubscribe()
  await mountManager.refreshAllStatuses()

  assert.deepEqual(events, [[['photos', 'disconnected']]])
})
