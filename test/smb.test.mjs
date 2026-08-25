import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
const {
  isSystemAutomountPath,
  triggerSystemAutomount,
  parseSMBMountLine
} = require('../out-test/core/smb.js')
const childProcess = require('node:child_process')

function loadSMBFresh() {
  delete require.cache[require.resolve('../out-test/core/smb.js')]
  return require('../out-test/core/smb.js')
}

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

test('redacts passwords from mount_smbfs failure messages', async () => {
  const originalSpawn = childProcess.spawn

  try {
    childProcess.spawn = () => {
      const proc = new EventEmitter()
      proc.stderr = new EventEmitter()
      process.nextTick(() => {
        proc.stderr.emit('data', 'mount_smbfs: mount error: //admin:super-secret@192.168.31.6/files: File exists\n')
        proc.emit('close', 64)
      })
      return proc
    }

    const { mountSMB } = loadSMBFresh()
    const result = await mountSMB('192.168.31.6', 'files', 'admin', 'super-secret', '/tmp')

    assert.equal(result.success, false)
    assert.equal(result.error.includes('super-secret'), false)
    assert.equal(result.error.includes('//admin:***@192.168.31.6/files'), true)
  } finally {
    childProcess.spawn = originalSpawn
    delete require.cache[require.resolve('../out-test/core/smb.js')]
  }
})

test('sends the SMB password through a pseudo-terminal instead of process arguments', async () => {
  const originalSpawn = childProcess.spawn
  const calls = []
  const input = []

  try {
    childProcess.spawn = (command, args, options) => {
      calls.push({ command, args, options })
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.stdin = {
        write(value) {
          input.push(value)
        },
        end() {}
      }
      process.nextTick(() => {
        proc.stdout.emit('data', 'Password for nas.local:')
        proc.emit('close', 0)
      })
      return proc
    }

    const { mountSMB } = loadSMBFresh()
    const result = await mountSMB('nas.local', 'files', 'admin', 'super-secret', '/tmp')

    assert.deepEqual(result, { success: true })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].command, '/usr/bin/expect')
    assert.equal(calls[0].args.some(arg => arg.includes('super-secret')), false)
    assert.equal(Object.values(calls[0].options.env).some(value => value?.includes('super-secret')), false)
    assert.deepEqual(input, ['super-secret\n'])
  } finally {
    childProcess.spawn = originalSpawn
    delete require.cache[require.resolve('../out-test/core/smb.js')]
  }
})

test('runs an interactive credential command when Node stdin is a socket', async () => {
  const password = 'pty-regression-secret'
  const expectedHash = createHash('sha256').update(password).digest('hex')
  const command = [
    'stty -echo',
    "printf 'Password for test:'",
    'IFS= read -r value',
    'stty echo',
    "printf '\\n'",
    "actual=$(/usr/bin/printf %s \"$value\" | /usr/bin/shasum -a 256 | /usr/bin/awk '{print $1}')",
    `if [ "$actual" = "${expectedHash}" ]; then printf 'credential accepted\\n'; exit 0; fi`,
    "printf 'credential rejected\\n'",
    'exit 42'
  ].join('; ')
  const { runCredentialCommand } = loadSMBFresh()

  const result = await runCredentialCommand('/bin/sh', ['-c', command], password, 3000)

  assert.equal(result.success, true)
  assert.match(result.output, /credential accepted/)
  assert.equal(result.output.includes(password), false)
  assert.equal(result.output.includes('tcgetattr\/ioctl'), false)
})

test('suggests a writable shared path when the mount directory cannot be created', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'smb-mounter-path-'))
  const blockingFile = join(temporaryRoot, 'blocking-file')
  writeFileSync(blockingFile, '')

  try {
    const { mountSMB } = loadSMBFresh()
    const result = await mountSMB(
      'nas.local',
      '文件',
      'admin',
      'secret',
      join(blockingFile, '文件')
    )

    assert.equal(result.success, false)
    assert.match(result.error, /Choose a writable path such as \/Users\/Shared\/SMB\/文件/)
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test('terminates an unmount command after its timeout', async () => {
  const originalSpawn = childProcess.spawn
  let killed = false

  try {
    childProcess.spawn = () => {
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.kill = () => {
        killed = true
      }
      setTimeout(() => {
        if (!killed) proc.emit('close', 0)
      }, 10)
      return proc
    }

    const { unmountSMB } = loadSMBFresh()
    const result = await unmountSMB('/Volumes/files', { timeoutMs: 1 })

    assert.equal(result.success, false)
    assert.match(result.error, /timed out after 1 ms/)
    assert.equal(killed, true)
  } finally {
    childProcess.spawn = originalSpawn
    delete require.cache[require.resolve('../out-test/core/smb.js')]
  }
})

test('bounds system mount-table reads with a timeout', async () => {
  const originalExecFile = childProcess.execFile
  let receivedOptions

  try {
    childProcess.execFile = (_command, _args, options, callback) => {
      receivedOptions = options
      const done = typeof options === 'function' ? options : callback
      done(null, { stdout: '', stderr: '' })
    }

    const { getMountedSMBShares } = loadSMBFresh()
    await getMountedSMBShares()

    assert.deepEqual(receivedOptions, { timeout: 5000 })
  } finally {
    childProcess.execFile = originalExecFile
    delete require.cache[require.resolve('../out-test/core/smb.js')]
  }
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
