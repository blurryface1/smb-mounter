import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDiscoveredShareOption,
  getGeneratedMountPath
} from '../out-test/renderer/ui/shareDiscoveryPresentation.js'

const savedMounts = [
  {
    id: 'share-1',
    name: 'Photos',
    server: 'fnnas.local',
    shareName: 'Photos',
    username: 'admin',
    mountPath: '/Users/Shared/SMB/Photos',
    autoMount: false,
    autoRetry: false,
    retryInterval: 30
  }
]

test('generates a local mount path for a selected share', () => {
  assert.equal(
    getGeneratedMountPath('/Users/Shared/SMB', 'Team Photos'),
    '/Users/Shared/SMB/Team Photos'
  )
  assert.equal(
    getGeneratedMountPath('/Users/Shared/SMB/', 'Photos'),
    '/Users/Shared/SMB/Photos'
  )
})

test('marks discovered shares that are already saved for the same user', () => {
  assert.deepEqual(
    buildDiscoveredShareOption({
      server: 'FNNAS.LOCAL',
      shareName: 'Photos',
      username: 'ADMIN',
      savedMounts
    }),
    {
      server: 'FNNAS.LOCAL',
      shareName: 'Photos',
      alreadySaved: true
    }
  )
})
