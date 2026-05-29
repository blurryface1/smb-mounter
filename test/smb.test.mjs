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

test('falls back to opening Finder when ls does not activate a system SMB automount path', async () => {
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
    attempts: 1
  })

  assert.equal(result, true)
  assert.deepEqual(calls, [
    ['/bin/ls', ['/System/Volumes/Data/mnt/SMB/UNRAID']],
    ['/usr/bin/open', ['/System/Volumes/Data/mnt/SMB/UNRAID']]
  ])
})
