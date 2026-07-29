const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xEDB88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPNG(size) {
  const w = size, h = size;
  const pixels = Buffer.alloc(w * h * 4);
  const cx = w / 2, cy = h / 2;
  const r = w * 0.38;
  const r2 = r * r;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = dx*dx + dy*dy;
      
      // Background: very light pink
      let R = 255, G = 245, B = 245, A = 255;
      
      // Apple body (ellipse, slightly wider than tall)
      const ax = dx / (r * 1.05);
      const ay = (dy - r * 0.05) / r;
      const appleDist = ax*ax + ay*ay;
      
      if (appleDist < 1.0) {
        // Gradient: lighter at top-left, darker at bottom-right
        const t = appleDist;
        const highlight = Math.max(0, 1 - t * 2.5);
        R = Math.round(232 + highlight * 23);
        G = Math.round(56 + highlight * 50);
        B = Math.round(56 + highlight * 50);
        
        // Top indent (stem area)
        if (dy < -r * 0.7 && Math.abs(dx) < r * 0.25) {
          R = 255; G = 245; B = 245;
        }
      }
      
      // Stem (brown)
      if (dy < -r * 0.55 && dy > -r * 0.85 && Math.abs(dx) < w * 0.018) {
        R = 139; G = 90; B = 43;
      }
      
      // Leaf (green, to the right of stem)
      const lx = dx - w * 0.04, ly = dy + r * 0.65;
      if (lx > 0 && lx < w * 0.1 && ly > -w * 0.04 && ly < w * 0.02) {
        const leafT = lx / (w * 0.1);
        if (Math.abs(ly) < w * 0.015 * (1 - leafT * 0.5)) {
          R = 100 + Math.round(leafT * 26);
          G = 180 - Math.round(leafT * 20);
          B = 60;
        }
      }
      
      pixels[idx] = R;
      pixels[idx+1] = G;
      pixels[idx+2] = B;
      pixels[idx+3] = A;
    }
  }
  
  // Add filter byte (0 = None) at start of each row
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    pixels.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y+1) * w * 4);
  }
  
  const compressed = zlib.deflateSync(raw);
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const dir = path.join(__dirname);
[192, 512].forEach(size => {
  const png = createPNG(size);
  const fname = `icon-${size}.png`;
  fs.writeFileSync(path.join(dir, fname), png);
  console.log(`Generated ${fname} (${png.length} bytes)`);
});

// Also create apple-touch-icon.png (180x180)
const touchIcon = createPNG(180);
fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), touchIcon);
console.log(`Generated apple-touch-icon.png (${touchIcon.length} bytes)`);

// favicon
const favicon = createPNG(32);
fs.writeFileSync(path.join(dir, 'favicon.png'), favicon);
console.log(`Generated favicon.png (${favicon.length} bytes)`);
