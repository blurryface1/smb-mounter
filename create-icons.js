const { existsSync, mkdirSync, writeFileSync } = require('fs')
const { join } = require('path')
const { execFileSync } = require('child_process')
const zlib = require('zlib')

const COLORS = {
  dockBackgroundTop: [42, 54, 69, 255],
  dockBackgroundBottom: [13, 18, 26, 255],
  diskTop: [226, 232, 238, 255],
  diskFace: [82, 93, 106, 255],
  diskLip: [172, 184, 196, 255],
  diskShadow: [7, 10, 15, 105],
  accent: [28, 211, 183, 255],
  accentDark: [13, 126, 116, 255],
  trayGlyph: [245, 247, 250, 255],
  trayShadow: [20, 24, 31, 190],
  connected: [31, 185, 95, 255],
  disconnected: [142, 148, 160, 255],
  error: [224, 67, 67, 255]
}

const iconSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]

function createChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const typeBuffer = Buffer.from(type)
  const crcData = Buffer.concat([typeBuffer, data])

  let crc = 0xffffffff
  for (let i = 0; i < crcData.length; i++) {
    crc ^= crcData[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }
  crc ^= 0xffffffff

  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc >>> 0, 0)

  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

function createPNG(width, height, pixels) {
  if (pixels.length !== width * height * 4) {
    throw new Error('Pixel buffer size does not match PNG dimensions')
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8
  ihdrData[9] = 6
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0

  const rawData = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4
      const target = y * (1 + width * 4) + 1 + x * 4
      rawData[target] = pixels[source]
      rawData[target + 1] = pixels[source + 1]
      rawData[target + 2] = pixels[source + 2]
      rawData[target + 3] = pixels[source + 3]
    }
  }

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdrData),
    createChunk('IDAT', zlib.deflateSync(rawData)),
    createChunk('IEND', Buffer.alloc(0))
  ])
}

function createSurface(size) {
  return {
    width: size,
    height: size,
    pixels: new Uint8ClampedArray(size * size * 4)
  }
}

function blendPixel(surface, x, y, color, alpha = color[3] / 255) {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || py < 0 || px >= surface.width || py >= surface.height || alpha <= 0) return

  const index = (py * surface.width + px) * 4
  const existingAlpha = surface.pixels[index + 3] / 255
  const nextAlpha = alpha + existingAlpha * (1 - alpha)

  for (let channel = 0; channel < 3; channel++) {
    const source = color[channel] / 255
    const existing = surface.pixels[index + channel] / 255
    const value = nextAlpha === 0 ? 0 : (source * alpha + existing * existingAlpha * (1 - alpha)) / nextAlpha
    surface.pixels[index + channel] = Math.round(value * 255)
  }

  surface.pixels[index + 3] = Math.round(nextAlpha * 255)
}

function mixColor(a, b, t) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * t))
}

function pointInRoundedRect(px, py, x, y, width, height, radius) {
  const dx = Math.max(x + radius - px, 0, px - (x + width - radius))
  const dy = Math.max(y + radius - py, 0, py - (y + height - radius))
  return dx * dx + dy * dy <= radius * radius
}

function fillRoundedRect(surface, x, y, width, height, radius, color) {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const right = Math.ceil(x + width)
  const bottom = Math.ceil(y + height)

  for (let py = top; py < bottom; py++) {
    for (let px = left; px < right; px++) {
      if (pointInRoundedRect(px + 0.5, py + 0.5, x, y, width, height, radius)) {
        blendPixel(surface, px, py, color)
      }
    }
  }
}

function fillRoundedGradient(surface, x, y, width, height, radius, topColor, bottomColor) {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const right = Math.ceil(x + width)
  const bottom = Math.ceil(y + height)

  for (let py = top; py < bottom; py++) {
    const t = height <= 1 ? 0 : (py - y) / height
    const color = mixColor(topColor, bottomColor, t)
    for (let px = left; px < right; px++) {
      if (pointInRoundedRect(px + 0.5, py + 0.5, x, y, width, height, radius)) {
        blendPixel(surface, px, py, color)
      }
    }
  }
}

function fillCircle(surface, cx, cy, radius, color) {
  const left = Math.floor(cx - radius)
  const top = Math.floor(cy - radius)
  const right = Math.ceil(cx + radius)
  const bottom = Math.ceil(cy + radius)

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      if (dx * dx + dy * dy <= radius * radius) {
        blendPixel(surface, x, y, color)
      }
    }
  }
}

function drawLine(surface, x1, y1, x2, y2, width, color) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2)
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps
    fillCircle(surface, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color)
  }
}

function surfaceToPNG(surface) {
  return createPNG(surface.width, surface.height, surface.pixels)
}

function drawDockIcon(size) {
  const surface = createSurface(size)
  const s = size / 1024

  fillRoundedGradient(surface, 64 * s, 64 * s, 896 * s, 896 * s, 210 * s, COLORS.dockBackgroundTop, COLORS.dockBackgroundBottom)

  fillRoundedRect(surface, 226 * s, 344 * s, 572 * s, 370 * s, 74 * s, COLORS.diskShadow)
  fillRoundedGradient(surface, 214 * s, 294 * s, 596 * s, 364 * s, 76 * s, [104, 116, 130, 255], COLORS.diskFace)
  fillRoundedGradient(surface, 256 * s, 226 * s, 512 * s, 238 * s, 62 * s, [246, 249, 252, 255], COLORS.diskTop)
  fillRoundedRect(surface, 306 * s, 304 * s, 412 * s, 64 * s, 28 * s, COLORS.diskLip)
  fillRoundedRect(surface, 346 * s, 326 * s, 332 * s, 20 * s, 10 * s, [118, 130, 145, 255])

  drawLine(surface, 512 * s, 646 * s, 512 * s, 754 * s, 34 * s, COLORS.accentDark)
  drawLine(surface, 512 * s, 754 * s, 392 * s, 826 * s, 34 * s, COLORS.accentDark)
  drawLine(surface, 512 * s, 754 * s, 632 * s, 826 * s, 34 * s, COLORS.accentDark)
  fillCircle(surface, 512 * s, 646 * s, 46 * s, COLORS.accent)
  fillCircle(surface, 392 * s, 826 * s, 38 * s, COLORS.accent)
  fillCircle(surface, 632 * s, 826 * s, 38 * s, COLORS.accent)
  fillCircle(surface, 700 * s, 552 * s, 24 * s, [41, 245, 204, 255])

  return surfaceToPNG(surface)
}

function statusColor(status) {
  if (status === 'connected') return COLORS.connected
  if (status === 'error') return COLORS.error
  return COLORS.disconnected
}

function drawTrayIcon(size, status) {
  const surface = createSurface(size)
  const s = size / 32

  fillRoundedRect(surface, 4 * s, 10 * s, 18 * s, 13 * s, 3 * s, COLORS.trayShadow)
  fillRoundedRect(surface, 6 * s, 8 * s, 14 * s, 5 * s, 2 * s, COLORS.trayShadow)
  fillRoundedRect(surface, 5 * s, 9 * s, 18 * s, 13 * s, 3 * s, COLORS.trayGlyph)
  fillRoundedRect(surface, 7 * s, 7 * s, 14 * s, 5 * s, 2 * s, COLORS.trayGlyph)
  fillRoundedRect(surface, 8 * s, 14 * s, 12 * s, 2 * s, 1 * s, [78, 89, 104, 220])

  fillCircle(surface, 23 * s, 22 * s, 6 * s, [255, 255, 255, 255])
  fillCircle(surface, 23 * s, 22 * s, 4 * s, statusColor(status))

  return surfaceToPNG(surface)
}

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

function generateIcons(options = {}) {
  const rootDir = options.rootDir ?? __dirname
  const runIconutil = options.runIconutil ?? true
  const assetsDir = join(rootDir, 'assets')
  const rendererAssetsDir = join(rootDir, 'src', 'renderer', 'assets')
  const buildDir = join(rootDir, 'build')
  const iconsetDir = join(buildDir, 'icon.iconset')

  ensureDir(assetsDir)
  ensureDir(rendererAssetsDir)
  ensureDir(iconsetDir)

  writeFileSync(join(assetsDir, 'trayConnected.png'), drawTrayIcon(32, 'connected'))
  writeFileSync(join(assetsDir, 'trayDisconnected.png'), drawTrayIcon(32, 'disconnected'))
  writeFileSync(join(assetsDir, 'trayError.png'), drawTrayIcon(32, 'error'))
  writeFileSync(join(rendererAssetsDir, 'windowIcon.png'), drawTrayIcon(64, 'connected'))

  for (const [filename, size] of iconSizes) {
    writeFileSync(join(iconsetDir, filename), drawDockIcon(size))
  }

  if (runIconutil) {
    execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', join(buildDir, 'icon.icns')])
  }
}

if (require.main === module) {
  generateIcons()
  console.log('Icons created')
}

module.exports = {
  createPNG,
  drawDockIcon,
  drawTrayIcon,
  generateIcons
}
