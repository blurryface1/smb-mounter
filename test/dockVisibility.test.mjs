import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
const { configureDocklessMenuBarMode } = require('../out-test/main/dockVisibility.js')

test('packages macOS app without Dock presence', () => {
  assert.equal(packageJson.build.mac.extendInfo?.LSUIElement, true)
})

test('configures macOS as an accessory menu bar app', () => {
  const policies = []
  let dockHideCalls = 0

  configureDocklessMenuBarMode({
    setActivationPolicy: (policy) => {
      policies.push(policy)
    },
    dock: {
      hide: () => {
        dockHideCalls += 1
      }
    }
  }, 'darwin')

  assert.deepEqual(policies, ['accessory'])
  assert.equal(dockHideCalls, 1)
})

test('does not change activation policy outside macOS', () => {
  const policies = []
  let dockHideCalls = 0

  configureDocklessMenuBarMode({
    setActivationPolicy: (policy) => {
      policies.push(policy)
    },
    dock: {
      hide: () => {
        dockHideCalls += 1
      }
    }
  }, 'linux')

  assert.deepEqual(policies, [])
  assert.equal(dockHideCalls, 0)
})
