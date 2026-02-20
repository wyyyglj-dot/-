const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function crc32(buf) {
  let table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[i] = c
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([len, typeAndData, crc])
}

function createPng(size) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Pixel data: orange background (#FF6B35) with white bowl shape
  const raw = []
  const cx = size / 2, cy = size / 2
  const r1 = size * 0.38 // outer bowl radius
  const r2 = size * 0.30 // inner bowl radius
  const baseY = cy + size * 0.05

  for (let y = 0; y < size; y++) {
    raw.push(0) // filter byte: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - baseY
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Rounded rectangle background
      const margin = size * 0.12
      const cornerR = size * 0.18
      let inBg = false
      const rx = Math.max(0, Math.abs(x - cx) - (cx - margin - cornerR))
      const ry = Math.max(0, Math.abs(y - cy) - (cy - margin - cornerR))
      if (Math.sqrt(rx * rx + ry * ry) <= cornerR) inBg = true

      if (!inBg) {
        // Transparent-ish (white for RGB)
        raw.push(245, 245, 245)
        continue
      }

      // Bowl shape: white semicircle on orange background
      const isBowlOuter = dist < r1 && dy > -size * 0.08
      const isBowlInner = dist < r2 && dy > -size * 0.02
      // Steam lines above bowl
      const steamY = baseY - size * 0.18
      const isSteam = y < steamY && y > steamY - size * 0.15 &&
        (Math.abs(x - (cx - size * 0.12)) < size * 0.02 ||
         Math.abs(x - cx) < size * 0.02 ||
         Math.abs(x - (cx + size * 0.12)) < size * 0.02) &&
        Math.sin((y - steamY) * 0.15 + (x > cx ? 1 : -1)) > -0.3

      if (isSteam) {
        raw.push(255, 255, 255) // white steam
      } else if (isBowlOuter && !isBowlInner) {
        raw.push(255, 255, 255) // white bowl rim
      } else if (isBowlInner) {
        raw.push(255, 140, 80) // lighter orange inside
      } else {
        raw.push(255, 107, 53) // #FF6B35 orange background
      }
    }
  }

  const rawBuf = Buffer.from(raw)
  const compressed = zlib.deflateSync(rawBuf)

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

function createIco(pngBuffers) {
  // ICO header
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)     // reserved
  header.writeUInt16LE(1, 2)     // type: ICO
  header.writeUInt16LE(pngBuffers.length, 4) // count

  const dirSize = 16 * pngBuffers.length
  let offset = 6 + dirSize
  const dirs = []
  const sizes = [256, 48, 32, 16]

  for (let i = 0; i < pngBuffers.length; i++) {
    const dir = Buffer.alloc(16)
    dir[0] = sizes[i] === 256 ? 0 : sizes[i] // width (0 = 256)
    dir[1] = sizes[i] === 256 ? 0 : sizes[i] // height
    dir[2] = 0  // palette
    dir[3] = 0  // reserved
    dir.writeUInt16LE(1, 4)  // planes
    dir.writeUInt16LE(24, 6) // bits per pixel
    dir.writeUInt32LE(pngBuffers[i].length, 8) // size
    dir.writeUInt32LE(offset, 12) // offset
    offset += pngBuffers[i].length
    dirs.push(dir)
  }

  return Buffer.concat([header, ...dirs, ...pngBuffers])
}

// Generate
const assetsDir = path.join(__dirname, 'assets')
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

const png512 = createPng(512)
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png512)
console.log('Created assets/icon.png (512x512)')

const ico = createIco([createPng(256), createPng(48), createPng(32), createPng(16)])
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico)
console.log('Created assets/icon.ico (256/48/32/16)')
