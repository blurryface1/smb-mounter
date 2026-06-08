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

  class MockTray {
    constructor(image) {
      trayImages.push(image)
    }

    on() {}

    setToolTip() {}

    setContextMenu() {}

    setImage(image) {
      trayImages.push(image)
    }
  }

  return {
    createdImages,
    trayImages,
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
  })
  updateTrayIcon('error')

  assert.equal(mock.trayImages.length, 2)
  assert.equal(mock.trayImages[0].template, true)
  assert.equal(mock.trayImages[1].template, true)
})
