import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  isSystemAutomountPath,
  triggerSystemAutomount,
  parseSMBMountLine
} = require('../out-test/core/smb.js')

test('recognizes macOS system SMB automount paths', () => {
  assert.equal(isSystemAutomountPath('/System/Volumes/Data/mnt/SMB/文件'), true)
  assert.equal(isSystemAutomountPath('/System/Volumes/Data/mnt/SMB/文件/子目录'), true)
  assert.equal(isSystemAutomountPath('/System/Volumes/Data/mnt/SMB'), false)
  assert.equal(isSystemAutomountPath('/Volumes/文件'), false)
})

test('parses percent-encoded SMB share names from mount output', () => {
  const parsed = parseSMBMountLine('//admin@FNNAS.local/%E5%A4%96%E6%8E%A5%E5%AD%98%E5%82%A8-ST4000VX015-3CU104_1 on /System/Volumes/Data/mnt/SMB/文件 (smbfs, nodev, nosuid, automounted, nobrowse, mounted by huangjiayu)')

  assert.deepEqual(parsed && {
    server: parsed.server,
    shareName: parsed.shareName,
    username: parsed.username,
    mountPath: parsed.mountPath
  }, {
    server: 'FNNAS.local',
    shareName: '外接存储-ST4000VX015-3CU104_1',
    username: 'admin',
    mountPath: '/System/Volumes/Data/mnt/SMB/文件'
  })
})

test('does not open Finder by default when ls does not activate a system SMB automount path', async () => {
  const calls = []

  const result = await triggerSystemAutomount('/System/Volumes/Data/mnt/SMB/UNRAID', {
    run: async (command, args) => {
      calls.push([command, args])
      throw new Error('ls did not activate autofs')
    },
    isActive: async () => false,
    wait: async () => undefined,
    attempts: 1,
    log: async () => undefined
  })

  assert.equal(result, false)
  assert.deepEqual(calls, [
    ['/bin/ls', ['/System/Volumes/Data/mnt/SMB/UNRAID']]
  ])
})

test('waits for a system SMB automount path to become active after ls triggers it', async () => {
  let activeChecks = 0
  const waits = []

  const result = await triggerSystemAutomount('/System/Volumes/Data/mnt/SMB/UNRAID', {
    run: async () => undefined,
    isActive: async () => {
      activeChecks += 1
      return activeChecks === 2
    },
    wait: async (ms) => {
      waits.push(ms)
    },
    attempts: 3,
    log: async () => undefined
  })

  assert.equal(result, true)
  assert.equal(activeChecks, 2)
  assert.deepEqual(waits, [500])
})

test('does not report a system SMB automount path active when ls succeeds but mount stays inactive', async () => {
  let activeChecks = 0

  const result = await triggerSystemAutomount('/System/Volumes/Data/mnt/SMB/UNRAID', {
    run: async () => undefined,
    isActive: async () => {
      activeChecks += 1
      return false
    },
    wait: async () => undefined,
    attempts: 2,
    log: async () => undefined
  })

  assert.equal(result, false)
  assert.equal(activeChecks, 2)
})

test('can open Finder when explicitly allowed for a system SMB automount path', async () => {
  const calls = []
  let active = false

  const result = await triggerSystemAutomount('/System/Volumes/Data/mnt/SMB/UNRAID', {
    run: async (command, args) => {
      calls.push([command, args])
      if (command === '/bin/ls') {
        throw new Error('ls did not activate autofs')
      }
      if (command === '/usr/bin/open') {
        active = true
      }
    },
    isActive: async () => active,
    wait: async () => undefined,
    attempts: 1,
    openInFinder: true,
    log: async () => undefined
  })

  assert.equal(result, true)
  assert.deepEqual(calls, [
    ['/bin/ls', ['/System/Volumes/Data/mnt/SMB/UNRAID']],
    ['/usr/bin/open', ['/System/Volumes/Data/mnt/SMB/UNRAID']]
  ])
})

test('can open a Finder SMB URL instead of the system SMB automount path', async () => {
  const calls = []
  let active = false

  const result = await triggerSystemAutomount('/System/Volumes/Data/mnt/SMB/文件', {
    run: async (command, args) => {
      calls.push([command, args])
      if (command === '/bin/ls') {
        throw new Error('ls did not activate autofs')
      }
      if (command === '/usr/bin/open' && args[0] === 'smb://admin@FNNAS.local/%E6%96%87%E4%BB%B6') {
        active = true
      }
    },
    isActive: async () => active,
    wait: async () => undefined,
    attempts: 1,
    openInFinder: true,
    finderTarget: 'smb://admin@FNNAS.local/%E6%96%87%E4%BB%B6',
    log: async () => undefined
  })

  assert.equal(result, true)
  assert.deepEqual(calls, [
    ['/bin/ls', ['/System/Volumes/Data/mnt/SMB/文件']],
    ['/usr/bin/open', ['smb://admin@FNNAS.local/%E6%96%87%E4%BB%B6']]
  ])
})
