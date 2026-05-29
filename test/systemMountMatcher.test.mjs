import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  normalizeSelectedPath,
  findMountForSelectedPath
} = require('../out-test/core/systemMountMatcher.js')

const mounts = [
  {
    server: 'nas.local',
    shareName: 'Media',
    username: 'alice',
    mountPath: '/Volumes/Media'
  },
  {
    server: 'nas.local',
    shareName: 'Projects',
    username: 'alice',
    mountPath: '/Volumes/Media/Projects'
  },
  {
    server: 'files.local',
    shareName: 'Archive',
    username: 'bob',
    mountPath: '/Volumes/Archive'
  }
]

test('normalizes trailing slashes while preserving root', () => {
  assert.equal(normalizeSelectedPath('/Volumes/Media/'), '/Volumes/Media')
  assert.equal(normalizeSelectedPath('/Volumes/Media///'), '/Volumes/Media')
  assert.equal(normalizeSelectedPath('/'), '/')
})

test('matches a mount by exact selected path', () => {
  assert.deepEqual(findMountForSelectedPath(mounts, '/Volumes/Media'), mounts[0])
})

test('matches a mount for a selected child folder', () => {
  assert.deepEqual(findMountForSelectedPath(mounts, '/Volumes/Archive/2026'), mounts[2])
})

test('prefers the longest matching mount path', () => {
  assert.deepEqual(findMountForSelectedPath(mounts, '/Volumes/Media/Projects/app'), mounts[1])
})

test('returns null when the selected path is outside known mounts', () => {
  assert.equal(findMountForSelectedPath(mounts, '/Users/alice/Desktop'), null)
  assert.equal(findMountForSelectedPath(mounts, '/Volumes/MediaArchive'), null)
})
