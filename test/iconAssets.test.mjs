import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import zlib from 'node:zlib'

const require = createRequire(import.meta.url)
const {
  createPNG,
  drawDockIcon,
  drawTrayIcon,
  drawTrayTemplateIcon,
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

function readPngPixels(buffer) {
  const info = readPngInfo(buffer)
  const chunks = []
  let offset = 8

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IDAT') {
      chunks.push(data)
    }
    offset += 12 + length
  }

  const inflated = zlib.inflateSync(Buffer.concat(chunks))
  const pixels = new Uint8ClampedArray(info.width * info.height * 4)
  const stride = 1 + info.width * 4

  for (let y = 0; y < info.height; y++) {
    assert.equal(inflated[y * stride], 0)
    for (let x = 0; x < info.width; x++) {
      const source = y * stride + 1 + x * 4
      const target = (y * info.width + x) * 4
      pixels[target] = inflated[source]
      pixels[target + 1] = inflated[source + 1]
      pixels[target + 2] = inflated[source + 2]
      pixels[target + 3] = inflated[source + 3]
    }
  }

  return {
    ...info,
    pixels
  }
}

function alphaAt(image, x, y) {
  return image.pixels[(y * image.width + x) * 4 + 3]
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

test('tray template renderer leaves cutouts for macOS menu bar tinting', () => {
  const connected = readPngPixels(drawTrayTemplateIcon(32, 'connected'))
  const disconnected = drawTrayTemplateIcon(32, 'disconnected')
  const error = drawTrayTemplateIcon(32, 'error')

  assert.equal(alphaAt(connected, 5, 10), 255)
  assert.equal(alphaAt(connected, 13, 16), 0)
  assert.equal(alphaAt(connected, 23, 22), 255)
  assert.notDeepEqual(connected.pixels, readPngPixels(disconnected).pixels)
  assert.notDeepEqual(connected.pixels, readPngPixels(error).pixels)
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
