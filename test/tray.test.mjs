import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import Module from 'node:module'

const require = createRequire(import.meta.url)

function loadTrayWithElectronMock(electronMock) {
  const modulePath = require.resolve('../out-test/main/tray.js')
  const originalLoad = Module._load

  delete require.cache[modulePath]
  Module._load = (request, parent, isMain) => {
    if (request === 'electron') return electronMock
    return originalLoad(request, parent, isMain)
  }

  try {
    return require(modulePath)
  } finally {
    Module._load = originalLoad
  }
}

function createElectronMock() {
  const createdImages = []
  const trayImages = []
  const contextMenus = []

  class MockTray {
    constructor(image) {
      trayImages.push(image)
    }

    on() {}

    setToolTip() {}

    setContextMenu(menu) {
      contextMenus.push(menu)
    }

    setImage(image) {
      trayImages.push(image)
    }
  }

  return {
    createdImages,
    trayImages,
    contextMenus,
    electron: {
      app: {
        isPackaged: false,
        quit() {}
      },
      Menu: {
        buildFromTemplate: (template) => template
      },
      nativeImage: {
        createEmpty: () => ({
          empty: true,
          isEmpty: () => true,
          resize() {
            return this
          },
          setTemplateImage() {}
        }),
        createFromPath: (path) => {
          const image = {
            path,
            template: false,
            isEmpty: () => false,
            resize() {
              return this
            },
            setTemplateImage(value) {
              this.template = value
            }
          }
          createdImages.push(image)
          return image
        }
      },
      Tray: MockTray
    }
  }
}

test('uses macOS template images for tray creation and status updates', () => {
  const mock = createElectronMock()
  const { setupTray, updateTrayIcon } = loadTrayWithElectronMock(mock.electron)

  setupTray({
    show() {},
    focus() {},
    webContents: {
      send() {}
    }
  }, {
    getAllStatuses: () => [],
    refreshAllStatuses: async () => [],
    onStatusesChanged: () => () => undefined
  })
  updateTrayIcon('error')

  assert.equal(mock.trayImages.length, 2)
  assert.equal(mock.trayImages[0].template, true)
  assert.equal(mock.trayImages[1].template, true)
})

test('derives the tray icon from live mount statuses', () => {
  const mock = createElectronMock()
  const listeners = []
  const statusSource = {
    getAllStatuses: () => [{ configId: 'photos', status: 'disconnected' }],
    refreshAllStatuses: async () => [],
    onStatusesChanged: (listener) => {
      listeners.push(listener)
      return () => undefined
    }
  }
  const { setupTray } = loadTrayWithElectronMock(mock.electron)

  setupTray({
    show() {},
    focus() {},
    webContents: { send() {} }
  }, statusSource)

  assert.match(mock.trayImages[0].path, /trayDisconnected\.png$/)
  assert.equal(listeners.length, 1)
  listeners[0]([{ configId: 'photos', status: 'error' }])
  assert.match(mock.trayImages.at(-1).path, /trayError\.png$/)
})

test('refreshes native mount statuses before notifying the renderer', async () => {
  const mock = createElectronMock()
  const events = []
  let refreshCalls = 0
  const { setupTray } = loadTrayWithElectronMock(mock.electron)

  setupTray({
    show() {},
    focus() {},
    webContents: {
      send(event) {
        events.push(event)
      }
    }
  }, {
    getAllStatuses: () => [],
    refreshAllStatuses: async () => {
      refreshCalls += 1
      return []
    },
    onStatusesChanged: () => () => undefined
  })

  const refreshItem = mock.contextMenus[0].find(item => item.label === 'Refresh All Mounts')
  await refreshItem.click()

  assert.equal(refreshCalls, 1)
  assert.deepEqual(events, ['refresh-all-mounts'])
})
