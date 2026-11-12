// Gera os ícones do PWA (192, 512 e maskable) em PNG puro, sem dependências.
// Desenho: fundo escuro do jogo + "grão de areia" dourado (o Sandman).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Codificador PNG mínimo (RGBA, sem dependências) ──────────────
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtro None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Desenho ──────────────────────────────────────────────────────
const DARK = [18, 16, 14];      // --bg
const SAND = [224, 164, 88];    // --accent
const SAND_DARK = [150, 104, 52];
const CREAM = [232, 224, 213];

function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };

  // Fundo (maskable: borda cheia; normal: cantos arredondados)
  const r = maskable ? 0 : size * 0.22;
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(0, Math.max(r - x, x - (size - 1 - r)));
      const dy = Math.max(0, Math.max(r - y, y - (size - 1 - r)));
      const inside = dx * dx + dy * dy <= r * r || (dx === 0 && dy === 0);
      if (inside) set(x, y, DARK);
    }
  }

  // Área segura do maskable = 80% central
  const m = maskable ? size * 0.1 : 0;
  const S = size - m * 2;
  const at = (fx, fy) => [Math.round(m + fx * S), Math.round(m + fy * S)];

  // Círculo de areia (grão)
  const [ccx, ccy] = at(0.5, 0.5);
  const R = S * 0.3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - ccx, y - ccy);
      if (d <= R) {
        // leve sombreamento radial
        const t = d / R;
        const col = [
          Math.round(SAND[0] * (1 - t * 0.35) + SAND_DARK[0] * t * 0.35),
          Math.round(SAND[1] * (1 - t * 0.35) + SAND_DARK[1] * t * 0.35),
          Math.round(SAND[2] * (1 - t * 0.35) + SAND_DARK[2] * t * 0.35),
        ];
        set(x, y, col);
      }
    }
  }

  // "S" estilizado de Sandman em escuro dentro do círculo
  const sw = Math.max(2, Math.round(S * 0.045)); // espessura do traço
  const stroke = (x, y, w = sw, h = sw) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(Math.round(x + i), Math.round(y + j), DARK);
  };
  // desenhamos a S com arcos grosseiros proporcionais
  const sTop = ccy - R * 0.55;
  const sBot = ccy + R * 0.55;
  const sLeft = ccx - R * 0.5;
  const sRight = ccx + R * 0.5;
  const arc = (x0, y0, x1, y1, bow, steps = 40) => {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * bow;
      stroke(x, y);
    }
  };
  // topo da S (curva para cima)
  arc(sLeft, sTop + R * 0.35, ccx, sTop, -R * 0.28);
  arc(ccx, sTop, sRight, sTop + R * 0.35, -R * 0.28);
  // meio
  arc(sRight, sTop + R * 0.35, sLeft, sBot - R * 0.35, R * 0.3);
  // base
  arc(sLeft, sBot - R * 0.35, ccx, sBot, R * 0.28);
  arc(ccx, sBot, sRight, sBot - R * 0.35, R * 0.28);

  // Graninhos de areia ao redor (pontos creme)
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < size / 2; i++) {
    const a = rnd() * Math.PI * 2;
    const d = R + rnd() * S * 0.14;
    const [x, y] = [Math.round(ccx + Math.cos(a) * d), Math.round(ccy + Math.sin(a) * d)];
    set(x, y, CREAM, 220);
  }

  return px;
}

// ── Geração ──────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
];

for (const [name, size, opts] of targets) {
  const png = encodePNG(size, size, draw(size, opts));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`✅ ${name} (${size}x${size}, ${png.length} bytes)`);
}
