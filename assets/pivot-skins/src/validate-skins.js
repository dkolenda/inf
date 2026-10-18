/* Validate the generated PNGs without external packages. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const WIDTH = 1536;
const HEIGHT = 1024;
const CELL = 512;
const PARTS = {
  head: { cell: [0, 0], top: 176, bottom: 428 },
  torso: { cell: [1, 0], top: 100, bottom: 412 },
  upperArm: { cell: [2, 0], top: 158, bottom: 354 },
  forearm: { cell: [0, 1], top: 168, bottom: 345 },
  thigh: { cell: [1, 1], top: 151, bottom: 361 },
  shin: { cell: [2, 1], top: 140, bottom: 371 }
};
const FILES = ['kowboj.png', 'policjant.png', 'krolewna.png'];
const DIR = path.resolve(__dirname, '..');

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function decodePng(file) {
  const source = fs.readFileSync(file);
  const signature = source.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${file}: invalid PNG signature.`);
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  const idat = [];
  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.subarray(offset + 4, offset + 8).toString('ascii');
    const data = source.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += length + 12;
  }
  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`${file}: expected 8-bit RGBA (PNG color type 6), got depth ${bitDepth}, type ${colorType}.`);
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(stride * height);
  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[input++];
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[input++];
      const left = x >= 4 ? rgba[row + x - 4] : 0;
      const up = y > 0 ? rgba[previous + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? rgba[previous + x - 4] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upperLeft);
      else throw new Error(`${file}: unsupported PNG filter ${filter}.`);
      rgba[row + x] = value & 255;
    }
  }
  return { source, width, height, rgba };
}

function alphaAt(image, x, y) {
  return image.rgba[(y * image.width + x) * 4 + 3];
}

function nearbyOpaque(image, x, y, radius = 2) {
  for (let yy = Math.max(0, y - radius); yy <= Math.min(image.height - 1, y + radius); yy += 1) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(image.width - 1, x + radius); xx += 1) {
      if (alphaAt(image, xx, yy) > 24) return true;
    }
  }
  return false;
}

function validate(file) {
  const fullPath = path.join(DIR, file);
  const image = decodePng(fullPath);
  const errors = [];
  if (image.width !== WIDTH || image.height !== HEIGHT) errors.push(`dimensions ${image.width}x${image.height}`);
  if (image.source.length >= 300 * 1024) errors.push(`file size ${(image.source.length / 1024).toFixed(1)} KB`);

  let transparent = 0;
  for (let pixel = 0; pixel < image.width * image.height; pixel += 1) {
    if (image.rgba[pixel * 4 + 3] === 0) transparent += 1;
  }
  if (transparent < image.width * image.height * 0.5) errors.push('background is not predominantly transparent');

  const bounds = [];
  for (const [name, part] of Object.entries(PARTS)) {
    const x0 = part.cell[0] * CELL;
    const y0 = part.cell[1] * CELL;
    let minX = CELL;
    let minY = CELL;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < CELL; y += 1) {
      for (let x = 0; x < CELL; x += 1) {
        if (alphaAt(image, x0 + x, y0 + y) !== 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) errors.push(`${name} cell is empty`);
    if (minX < 4 || minY < 4 || maxX > 507 || maxY > 507) {
      errors.push(`${name} margin is under 4 px (${minX},${minY})-(${maxX},${maxY})`);
    }
    const centerX = x0 + 256;
    for (let y = part.top; y <= part.bottom; y += 2) {
      if (!nearbyOpaque(image, centerX, y0 + y, 1)) {
        errors.push(`${name} misses the template centre line near y=${y}`);
        break;
      }
    }
    if (!nearbyOpaque(image, centerX, y0 + part.top) || !nearbyOpaque(image, centerX, y0 + part.bottom)) {
      errors.push(`${name} does not cover both joint points`);
    }
    bounds.push(`${name} ${minX},${minY}-${maxX},${maxY}`);
  }

  const head = PARTS.head;
  const cx = head.cell[0] * CELL + 256;
  const cy = head.cell[1] * CELL + (head.top + head.bottom) / 2;
  const radius = (head.bottom - head.top) / 2;
  for (let degree = 0; degree < 360; degree += 5) {
    const radians = degree * Math.PI / 180;
    const x = Math.round(cx + Math.cos(radians) * radius);
    const y = Math.round(cy + Math.sin(radians) * radius);
    if (!nearbyOpaque(image, x, y, 4)) {
      errors.push(`head misses template circle near ${degree} degrees`);
      break;
    }
  }

  if (errors.length) throw new Error(`${file}: ${errors.join('; ')}`);
  console.log(`PASS ${file}: ${image.width}x${image.height}, RGBA, ${(image.source.length / 1024).toFixed(1)} KB, transparent ${(transparent * 100 / (image.width * image.height)).toFixed(1)}%`);
  console.log(`     ${bounds.join(' | ')}`);
}

for (const file of FILES) validate(file);

