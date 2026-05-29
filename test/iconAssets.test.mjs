import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  createPNG,
  drawDockIcon,
  drawTrayIcon,
  generateIcons
} = require('../create-icons.js')

function readPngInfo(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25]
  }
}

test('createPNG emits transparent RGBA PNGs with the requested dimensions', () => {
  const pixels = new Uint8ClampedArray(16 * 16 * 4)
  pixels[3] = 255

  const png = createPNG(16, 16, pixels)
  const info = readPngInfo(png)

  assert.deepEqual(info, {
    width: 16,
    height: 16,
    bitDepth: 8,
    colorType: 6
  })
})

test('dock and tray renderers produce non-empty non-solid PNGs', () => {
  const dock = drawDockIcon(128)
  const tray = drawTrayIcon(32, 'connected')

  assert.deepEqual(readPngInfo(dock), {
    width: 128,
    height: 128,
    bitDepth: 8,
    colorType: 6
  })
  assert.deepEqual(readPngInfo(tray), {
    width: 32,
    height: 32,
    bitDepth: 8,
    colorType: 6
  })
  assert.notEqual(dock.equals(drawDockIcon(128).subarray(0, dock.length - 1)), true)
  assert.notEqual(dock.equals(tray), true)
})

test('generateIcons writes tray PNGs, iconset PNGs, and icon.icns', () => {
  const dir = mkdtempSync(join(tmpdir(), 'smb-mounter-icons-'))

  try {
    generateIcons({
      rootDir: dir,
      runIconutil: false
    })

    for (const file of [
      'assets/trayConnected.png',
      'assets/trayDisconnected.png',
      'assets/trayError.png',
      'build/icon.iconset/icon_16x16.png',
      'build/icon.iconset/icon_512x512@2x.png'
    ]) {
      const path = join(dir, file)
      assert.equal(existsSync(path), true, `${file} should exist`)
      assert.equal(readPngInfo(readFileSync(path)).colorType, 6)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
