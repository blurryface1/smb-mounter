import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  getMountIdentityKey,
  isSameMountIdentity,
  dedupeDetectedMounts
} = require('../out-test/core/mountIdentity.js')

test('matches SMB mounts by server, share, and username independent of path', () => {
  const config = {
    server: 'nas.local',
    shareName: 'UNRAID',
    username: 'alice',
    mountPath: '/System/Volumes/Data/mnt/SMB/UNRAID'
  }

  const detected = {
    server: 'NAS.LOCAL',
    shareName: 'UNRAID',
    username: 'alice',
    mountPath: '/Volumes/UNRAID'
  }

  assert.equal(isSameMountIdentity(config, detected), true)
  assert.equal(getMountIdentityKey(config), 'nas.local/unraid/alice')
})

test('dedupes duplicate detected mounts and prefers managed SMB paths', () => {
  const mounts = dedupeDetectedMounts([
    {
      server: 'nas.local',
      shareName: 'UNRAID',
      username: 'alice',
      mountPath: '/Volumes/UNRAID'
    },
    {
      server: 'nas.local',
      shareName: 'UNRAID',
      username: 'alice',
      mountPath: '/System/Volumes/Data/mnt/SMB/UNRAID'
    },
    {
      server: 'nas.local',
      shareName: '文件',
      username: 'alice',
      mountPath: '/System/Volumes/Data/mnt/SMB/文件'
    }
  ])

  assert.deepEqual(mounts.map(mount => mount.mountPath), [
    '/System/Volumes/Data/mnt/SMB/UNRAID',
    '/System/Volumes/Data/mnt/SMB/文件'
  ])
})
