import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'

const require = createRequire(import.meta.url)
const {
  discoverSMBServers,
  listSMBShares
} = require('../out-test/core/shareDiscovery.js')
const childProcess = require('node:child_process')

function loadShareDiscoveryFresh() {
  delete require.cache[require.resolve('../out-test/core/shareDiscovery.js')]
  return require('../out-test/core/shareDiscovery.js')
}

test('discovers unique SMB servers from macOS browse output', async () => {
  const output = [
    'Browsing for _smb._tcp',
    'Timestamp     A/R    Flags  if Domain               Service Type         Instance Name',
    '10:13:14.537  Add        3  14 local.               _smb._tcp.           FNNAS',
    '10:13:15.100  Add        3  14 local.               _smb._tcp.           Mac mini',
    '10:13:16.200  Add        3  14 local.               _smb._tcp.           FNNAS'
  ].join('\n')

  const servers = await discoverSMBServers({
    browse: async () => output
  })

  assert.deepEqual(servers, [
    { name: 'FNNAS', serviceName: 'FNNAS' },
    { name: 'Mac mini', serviceName: 'Mac mini' }
  ])
})

test('can attach resolved hostnames to discovered SMB servers', async () => {
  const output = [
    '10:13:14.537  Add        3  14 local.               _smb._tcp.           FNNAS',
    '10:13:15.100  Add        3  14 local.               _smb._tcp.           Mac mini'
  ].join('\n')

  const servers = await discoverSMBServers({
    browse: async () => output,
    resolve: async (serviceName) => serviceName === 'Mac mini' ? 'mac-mini.local' : null
  })

  assert.deepEqual(servers, [
    { name: 'FNNAS', serviceName: 'FNNAS' },
    { name: 'Mac mini', serviceName: 'Mac mini', host: 'mac-mini.local' }
  ])
})

test('resolves discovered SMB servers concurrently', async () => {
  const output = [
    '10:13:14.537  Add        3  14 local.               _smb._tcp.           FNNAS',
    '10:13:15.100  Add        3  14 local.               _smb._tcp.           Mac mini'
  ].join('\n')
  const calls = []
  let releaseResolvers
  const resolverGate = new Promise(resolve => {
    releaseResolvers = resolve
  })

  const discovery = discoverSMBServers({
    browse: async () => output,
    resolve: async (serviceName) => {
      calls.push(serviceName)
      await resolverGate
      return `${serviceName}.local`
    }
  })

  await new Promise(resolve => setImmediate(resolve))
  const callsBeforeRelease = [...calls]
  releaseResolvers()
  await discovery

  assert.deepEqual(callsBeforeRelease, ['FNNAS', 'Mac mini'])
})

test('discovers native SMB server hostnames with dns-sd resolve output', async () => {
  const originalSpawn = childProcess.spawn
  const originalExecFile = childProcess.execFile

  try {
    childProcess.spawn = () => {
      const listeners = new Map()
      const proc = {
        stdout: {
          on(event, handler) {
            if (event === 'data') {
              handler(Buffer.from('10:13:14.537  Add        3  14 local.               _smb._tcp.           Mac mini\n'))
            }
          }
        },
        stderr: {
          on() {}
        },
        on(event, handler) {
          listeners.set(event, handler)
          return proc
        },
        kill(signal) {
          listeners.get('close')?.(0, signal)
          return true
        }
      }

      return proc
    }

    childProcess.execFile = (command, args, options, callback) => {
      assert.equal(command, 'dns-sd')
      assert.deepEqual(args, ['-L', 'Mac mini', '_smb._tcp', 'local'])
      callback(null, {
        stdout: 'Mac mini._smb._tcp.local. can be reached at mac-mini.local.:445 (interface 14)\n',
        stderr: ''
      })
    }

    const { discoverSMBServers: discoverWithNativeResolve } = loadShareDiscoveryFresh()
    const servers = await discoverWithNativeResolve({ timeoutMs: 1 })

    assert.deepEqual(servers, [
      { name: 'Mac mini', serviceName: 'Mac mini', host: 'mac-mini.local' }
    ])
  } finally {
    childProcess.spawn = originalSpawn
    childProcess.execFile = originalExecFile
    delete require.cache[require.resolve('../out-test/core/shareDiscovery.js')]
  }
})

test('keeps dns-sd resolve stdout when the resolve command times out', async () => {
  const originalSpawn = childProcess.spawn
  const originalExecFile = childProcess.execFile

  try {
    childProcess.spawn = () => {
      const listeners = new Map()
      const proc = {
        stdout: {
          on(event, handler) {
            if (event === 'data') {
              handler(Buffer.from('10:13:14.537  Add        3  14 local.               _smb._tcp.           FNNAS\n'))
            }
          }
        },
        stderr: {
          on() {}
        },
        on(event, handler) {
          listeners.set(event, handler)
          return proc
        },
        kill(signal) {
          listeners.get('close')?.(0, signal)
          return true
        }
      }

      return proc
    }

    childProcess.execFile = (_command, _args, _options, callback) => {
      const error = new Error('Command failed because it timed out')
      error.stdout = 'FNNAS._smb._tcp.local. can be reached at FNNAS.local.:445 (interface 14)\n'
      callback(error)
    }

    const { discoverSMBServers: discoverWithTimedOutResolve } = loadShareDiscoveryFresh()
    const servers = await discoverWithTimedOutResolve({ timeoutMs: 1, resolveTimeoutMs: 1 })

    assert.deepEqual(servers, [
      { name: 'FNNAS', serviceName: 'FNNAS', host: 'FNNAS.local' }
    ])
  } finally {
    childProcess.spawn = originalSpawn
    childProcess.execFile = originalExecFile
    delete require.cache[require.resolve('../out-test/core/shareDiscovery.js')]
  }
})

test('discovers SMB servers with native dns-sd when browse is not injected', async () => {
  const originalSpawn = childProcess.spawn
  const originalExecFile = childProcess.execFile

  try {
    childProcess.spawn = (command, args, options) => {
      assert.equal(command, 'dns-sd')
      assert.deepEqual(args, ['-B', '_smb._tcp', 'local'])
      assert.deepEqual(options, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      const listeners = new Map()
      const proc = {
        stdout: {
          on(event, handler) {
            if (event === 'data') {
              handler(Buffer.from([
                'Browsing for _smb._tcp\n',
                'Timestamp     A/R    Flags  if Domain               Service Type         Instance Name\n',
                '10:13:14.537  Add        3  14 local.               _smb._tcp.           FNNAS\n'
              ].join('')))
            }
          }
        },
        stderr: {
          on() {}
        },
        on(event, handler) {
          listeners.set(event, handler)
          return proc
        },
        kill(signal) {
          assert.equal(signal, 'SIGINT')
          listeners.get('close')?.(0, signal)
          return true
        }
      }

      return proc
    }

    childProcess.execFile = (command, args, options, callback) => {
      callback(null, { stdout: '', stderr: '' })
    }

    const { discoverSMBServers: discoverWithNativeBrowse } = loadShareDiscoveryFresh()
    const servers = await discoverWithNativeBrowse({ timeoutMs: 1 })

    assert.deepEqual(servers, [
      { name: 'FNNAS', serviceName: 'FNNAS' }
    ])
  } finally {
    childProcess.spawn = originalSpawn
    childProcess.execFile = originalExecFile
    delete require.cache[require.resolve('../out-test/core/shareDiscovery.js')]
  }
})

test('lists visible shares from a selected SMB server', async () => {
  const output = [
    'Share                                           Type    Comments',
    '-------------------------------                 ----    --------',
    'Photos                                          Disk',
    'Team Photos                                     Disk',
    'Projects                                        Disk',
    'IPC$                                            Pipe    IPC Service',
    'ADMIN$                                          Disk',
    'Hidden$                                         Disk'
  ].join('\n')

  const shares = await listSMBShares({
    server: 'FNNAS.local',
    username: 'admin',
    password: 'secret',
    view: async (request) => {
      assert.deepEqual(request, {
        server: 'FNNAS.local',
        username: 'admin',
        password: 'secret'
      })
      return output
    }
  })

  assert.deepEqual(shares, [
    { shareName: 'Photos', isHidden: false, isAdministrative: false },
    { shareName: 'Team Photos', isHidden: false, isAdministrative: false },
    { shareName: 'Projects', isHidden: false, isAdministrative: false }
  ])
})

test('does not expose passwords when native share listing fails', async () => {
  const originalSpawn = childProcess.spawn
  const originalExecFile = childProcess.execFile
  let spawned = false

  try {
    childProcess.execFile = (_command, args, _options, callback) => {
      callback(new Error(`failed command: ${args.join(' ')}`))
    }
    childProcess.spawn = (_command, args) => {
      spawned = true
      assert.equal(args.some(arg => arg.includes('super-secret')), false)
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.stdin = { write() {}, end() {} }
      process.nextTick(() => {
        proc.stderr.emit('data', 'authentication failed for super-secret')
        proc.emit('close', 1)
      })
      return proc
    }

    const { listSMBShares: listWithNativeView } = loadShareDiscoveryFresh()
    await assert.rejects(
      () => listWithNativeView({
        server: 'FNNAS.local',
        username: 'admin',
        password: 'super-secret'
      }),
      (error) => {
        assert.equal(error instanceof Error, true)
        assert.equal(String(error.message).includes('super-secret'), false)
        return true
      }
    )
    assert.equal(spawned, true)
  } finally {
    childProcess.spawn = originalSpawn
    childProcess.execFile = originalExecFile
    delete require.cache[require.resolve('../out-test/core/shareDiscovery.js')]
  }
})

test('lists SMB shares with native smbutil when view is not injected', async () => {
  const originalSpawn = childProcess.spawn
  const originalExecFile = childProcess.execFile
  const input = []

  try {
    childProcess.execFile = (command) => {
      assert.notEqual(command, 'smbutil')
    }
    childProcess.spawn = (command, args, options) => {
      assert.equal(command, '/usr/bin/expect')
      assert.equal(args.some(arg => arg.includes('secret')), false)
      const credentialEnvironment = Object.entries(options.env)
        .filter(([key]) => key.startsWith('SMB_MOUNTER_'))
        .map(([, value]) => value)
      assert.equal(credentialEnvironment.some(value => value?.includes('secret')), false)
      assert.equal(credentialEnvironment.includes('/usr/bin/smbutil'), true)
      assert.equal(credentialEnvironment.includes('//admin@FNNAS.local'), true)

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
        proc.stdout.emit('data', 'Password for FNNAS.local:\n')
        proc.stdout.emit('data', [
          'Share                                           Type    Comments',
          '-------------------------------                 ----    --------',
          'Photos                                          Disk',
          'IPC$                                            Pipe    IPC Service'
        ].join('\n'))
        proc.emit('close', 0)
      })
      return proc
    }

    const { listSMBShares: listWithNativeView } = loadShareDiscoveryFresh()
    const shares = await listWithNativeView({
      server: 'FNNAS.local',
      username: 'admin',
      password: 'secret'
    })

    assert.deepEqual(shares, [
      { shareName: 'Photos', isHidden: false, isAdministrative: false }
    ])
    assert.deepEqual(input, ['secret\n'])
  } finally {
    childProcess.spawn = originalSpawn
    childProcess.execFile = originalExecFile
    delete require.cache[require.resolve('../out-test/core/shareDiscovery.js')]
  }
})

test('can include hidden and administrative shares when requested', async () => {
  const output = [
    'Share                                           Type    Comments',
    '-------------------------------                 ----    --------',
    'Photos                                          Disk',
    'IPC$                                            Pipe    IPC Service',
    'ADMIN$                                          Disk',
    'Hidden$                                         Disk'
  ].join('\n')

  const shares = await listSMBShares({
    server: 'FNNAS.local',
    username: 'admin',
    password: 'secret',
    includeHidden: true,
    view: async () => output
  })

  assert.deepEqual(shares, [
    { shareName: 'Photos', isHidden: false, isAdministrative: false },
    { shareName: 'IPC$', isHidden: true, isAdministrative: true },
    { shareName: 'ADMIN$', isHidden: true, isAdministrative: true },
    { shareName: 'Hidden$', isHidden: true, isAdministrative: false }
  ])
})
