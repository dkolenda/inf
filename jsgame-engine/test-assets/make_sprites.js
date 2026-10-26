#!/usr/bin/env node

// Deterministic, dependency-free sprite-sheet generator.
// Run with: node make_sprites.js

"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const FRAME = 128;
const COLORS = {
  black: [11, 18, 26, 255],
  blueDark: [18, 86, 153, 255],
  blue: [20, 167, 229, 255],
  blueLight: [112, 226, 255, 255],
  steel: [55, 75, 99, 255],
  joint: [28, 42, 58, 255],
  yellow: [255, 190, 32, 255],
  yellowLight: [255, 242, 128, 255],
  red: [222, 48, 61, 255],
  redDark: [139, 25, 42, 255],
};

class Bitmap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
  }

  setPixel(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
    this.data[i + 3] = color[3];
  }

  alphaCount(x0 = 0, y0 = 0, width = this.width, height = this.height) {
    let count = 0;
    for (let y = y0; y < y0 + height; y += 1) {
      for (let x = x0; x < x0 + width; x += 1) {
        if (this.data[(y * this.width + x) * 4 + 3] !== 0) count += 1;
      }
    }
    return count;
  }

  blit(source, dx, dy) {
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const si = (y * source.width + x) * 4;
        if (source.data[si + 3] === 0) continue;
        const di = ((dy + y) * this.width + dx + x) * 4;
        source.data.copy(this.data, di, si, si + 4);
      }
    }
  }
}

function emptyMask(width = FRAME, height = FRAME) {
  return new Uint8Array(width * height);
}

function polygonMask(points) {
  const mask = emptyMask();
  const ys = points.map((point) => point[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(FRAME - 1, Math.ceil(Math.max(...ys)));

  for (let y = minY; y <= maxY; y += 1) {
    const scanY = y + 0.5;
    const intersections = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi > scanY) !== (yj > scanY)) {
        intersections.push(xi + ((scanY - yi) * (xj - xi)) / (yj - yi));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const minX = Math.max(0, Math.ceil(intersections[i] - 0.5));
      const maxX = Math.min(FRAME - 1, Math.floor(intersections[i + 1] - 0.5));
      for (let x = minX; x <= maxX; x += 1) mask[y * FRAME + x] = 1;
    }
  }
  return mask;
}

function ellipseMask(cx, cy, rx, ry) {
  const mask = emptyMask();
  const minX = Math.max(0, Math.floor(cx - rx));
  const maxX = Math.min(FRAME - 1, Math.ceil(cx + rx));
  const minY = Math.max(0, Math.floor(cy - ry));
  const maxY = Math.min(FRAME - 1, Math.ceil(cy + ry));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) mask[y * FRAME + x] = 1;
    }
  }
  return mask;
}

function capsuleMask(x1, y1, x2, y2, radius) {
  const mask = emptyMask();
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy || 1;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius));
  const maxX = Math.min(FRAME - 1, Math.ceil(Math.max(x1, x2) + radius));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius));
  const maxY = Math.min(FRAME - 1, Math.ceil(Math.max(y1, y2) + radius));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
      const dx = px - (x1 + t * vx);
      const dy = py - (y1 + t * vy);
      if (dx * dx + dy * dy <= radius * radius) mask[y * FRAME + x] = 1;
    }
  }
  return mask;
}

function paintMask(bitmap, mask, fill, outline = COLORS.black, outlineWidth = 2) {
  if (outline && outlineWidth > 0) {
    for (let y = 0; y < FRAME; y += 1) {
      for (let x = 0; x < FRAME; x += 1) {
        if (!mask[y * FRAME + x]) continue;
        for (let oy = -outlineWidth; oy <= outlineWidth; oy += 1) {
          for (let ox = -outlineWidth; ox <= outlineWidth; ox += 1) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) <= outlineWidth) {
              bitmap.setPixel(x + ox, y + oy, outline);
            }
          }
        }
      }
    }
  }
  for (let y = 0; y < FRAME; y += 1) {
    for (let x = 0; x < FRAME; x += 1) {
      if (mask[y * FRAME + x]) bitmap.setPixel(x, y, fill);
    }
  }
}

function poly(bitmap, points, fill, outline = COLORS.black, outlineWidth = 2) {
  paintMask(bitmap, polygonMask(points), fill, outline, outlineWidth);
}

function ellipse(bitmap, cx, cy, rx, ry, fill, outline = COLORS.black, outlineWidth = 2) {
  paintMask(bitmap, ellipseMask(cx, cy, rx, ry), fill, outline, outlineWidth);
}

function capsule(bitmap, x1, y1, x2, y2, radius, fill, outline = COLORS.black, outlineWidth = 2) {
  paintMask(bitmap, capsuleMask(x1, y1, x2, y2, radius), fill, outline, outlineWidth);
}

function rect(bitmap, x, y, width, height, fill) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) bitmap.setPixel(px, py, fill);
  }
}

function drawLeg(bitmap, hip, knee, ankle, footForward, front) {
  const upper = front ? COLORS.blue : COLORS.blueDark;
  const lower = front ? COLORS.blueLight : COLORS.blue;
  capsule(bitmap, hip[0], hip[1], knee[0], knee[1], 7, upper);
  ellipse(bitmap, knee[0], knee[1], 6, 6, COLORS.joint);
  capsule(bitmap, knee[0], knee[1], ankle[0], ankle[1], 6, lower);
  const toe = footForward ? ankle[0] + 11 : ankle[0] - 8;
  poly(bitmap, [
    [ankle[0] - 6, ankle[1] - 2],
    [toe, ankle[1] - 2],
    [toe + 4, ankle[1] + 5],
    [ankle[0] - 7, ankle[1] + 5],
  ], front ? COLORS.blueLight : COLORS.blue);
  rect(bitmap, Math.min(ankle[0] - 4, toe), ankle[1], Math.abs(toe - ankle[0]) + 3, 2,
    front ? COLORS.blueLight : COLORS.blue);
}

function drawArm(bitmap, shoulder, elbow, hand, front) {
  const upper = front ? COLORS.blueLight : COLORS.blueDark;
  capsule(bitmap, shoulder[0], shoulder[1], elbow[0], elbow[1], 5, upper);
  ellipse(bitmap, elbow[0], elbow[1], 5, 5, COLORS.joint);
  capsule(bitmap, elbow[0], elbow[1], hand[0], hand[1], 4, front ? COLORS.blue : COLORS.steel);
  ellipse(bitmap, hand[0], hand[1], 5, 5, COLORS.joint);
}

const RUN_POSES = [
  { body: 0, front: [[65, 89], [79, 101], [91, 112], true], back: [[58, 89], [45, 102], [32, 112], false], arms: [[74, 67], [84, 78], [92, 73], [56, 67], [47, 78], [40, 84]] },
  { body: 2, front: [[65, 91], [76, 103], [82, 112], true], back: [[58, 91], [49, 104], [38, 112], false], arms: [[74, 69], [82, 82], [90, 80], [56, 69], [47, 78], [39, 81]] },
  { body: 1, front: [[64, 90], [64, 103], [76, 112], true], back: [[58, 90], [56, 103], [48, 112], false], arms: [[73, 68], [78, 82], [84, 87], [55, 68], [48, 76], [43, 72]] },
  { body: -1, front: [[64, 88], [56, 98], [48, 106], true], back: [[58, 88], [69, 99], [75, 112], true], arms: [[73, 66], [69, 78], [63, 84], [55, 66], [48, 72], [42, 66]] },
  { body: 0, front: [[58, 89], [45, 102], [32, 112], false], back: [[65, 89], [79, 101], [91, 112], true], arms: [[56, 67], [47, 78], [40, 84], [74, 67], [84, 78], [92, 73]] },
  { body: 2, front: [[58, 91], [49, 104], [38, 112], false], back: [[65, 91], [76, 103], [82, 112], true], arms: [[56, 69], [47, 78], [39, 81], [74, 69], [82, 82], [90, 80]] },
  { body: 1, front: [[58, 90], [56, 103], [48, 112], false], back: [[64, 90], [64, 103], [76, 112], true], arms: [[55, 68], [48, 76], [43, 72], [73, 68], [78, 82], [84, 87]] },
  { body: -1, front: [[58, 88], [69, 99], [75, 112], true], back: [[64, 88], [56, 98], [48, 106], true], arms: [[55, 66], [48, 72], [42, 66], [73, 66], [69, 78], [63, 84]] },
];

function drawRobotFrame(pose, idle = false) {
  const bitmap = new Bitmap(FRAME, FRAME);
  const bodyY = pose.body || 0;

  // Rear scarf, rear leg and rear arm.
  poly(bitmap, [[47, 51 + bodyY], [31, 47 + bodyY], [17, 51 + bodyY], [31, 55 + bodyY], [18, 60 + bodyY], [47, 58 + bodyY]], COLORS.redDark);

  if (idle) {
    drawLeg(bitmap, [58, 88], [54, 101], [50, 112], false, false);
    drawLeg(bitmap, [66, 88], [70, 101], [72, 112], true, true);
    drawArm(bitmap, [55, 67 + bodyY], [50, 79 + bodyY], [52, 90 + bodyY], false);
  } else {
    drawLeg(bitmap, pose.back[0], pose.back[1], pose.back[2], pose.back[3], false);
    drawArm(bitmap, pose.arms[3], pose.arms[4], pose.arms[5], false);
  }

  // Torso and hip assembly.
  poly(bitmap, [[51, 58 + bodyY], [70, 57 + bodyY], [79, 68 + bodyY], [74, 88 + bodyY], [52, 89 + bodyY], [46, 72 + bodyY]], COLORS.blue);
  poly(bitmap, [[55, 62 + bodyY], [70, 62 + bodyY], [72, 72 + bodyY], [54, 72 + bodyY]], COLORS.blueLight, null, 0);
  rect(bitmap, 57, 64 + bodyY, 12, 3, COLORS.blueLight);
  ellipse(bitmap, 62, 88, 14, 8, COLORS.steel);
  rect(bitmap, 56, 84, 13, 4, COLORS.blueDark);

  if (idle) {
    drawArm(bitmap, [73, 67 + bodyY], [80, 79 + bodyY], [79, 91 + bodyY], true);
  } else {
    drawArm(bitmap, pose.arms[0], pose.arms[1], pose.arms[2], true);
    drawLeg(bitmap, pose.front[0], pose.front[1], pose.front[2], pose.front[3], true);
  }

  // Neck scarf wraps in front of the torso.
  poly(bitmap, [[45, 53 + bodyY], [72, 52 + bodyY], [77, 59 + bodyY], [49, 62 + bodyY]], COLORS.red);
  rect(bitmap, 52, 55 + bodyY, 20, 3, [255, 92, 83, 255]);

  // Head and forward-facing visor.
  poly(bitmap, [[42, 23 + bodyY], [50, 14 + bodyY], [70, 11 + bodyY], [86, 17 + bodyY], [94, 29 + bodyY], [91, 47 + bodyY], [81, 55 + bodyY], [53, 53 + bodyY], [42, 43 + bodyY]], COLORS.blue);
  poly(bitmap, [[49, 24 + bodyY], [57, 17 + bodyY], [75, 15 + bodyY], [84, 20 + bodyY], [58, 21 + bodyY]], COLORS.blueLight, null, 0);
  poly(bitmap, [[73, 27 + bodyY], [93, 28 + bodyY], [92, 43 + bodyY], [84, 50 + bodyY], [73, 45 + bodyY]], COLORS.yellow);
  poly(bitmap, [[81, 30 + bodyY], [90, 31 + bodyY], [89, 38 + bodyY], [85, 37 + bodyY]], COLORS.yellowLight, null, 0);
  ellipse(bitmap, 52, 38 + bodyY, 9, 10, COLORS.blueDark);
  ellipse(bitmap, 52, 38 + bodyY, 4, 5, COLORS.yellow);
  rect(bitmap, 57, 48 + bodyY, 16, 3, COLORS.blueDark);
  rect(bitmap, 54, 19 + bodyY, 15, 3, [174, 243, 255, 255]);

  return bitmap;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(bitmap) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bitmap.width, 0);
  ihdr.writeUInt32BE(bitmap.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = bitmap.width * 4;
  const raw = Buffer.alloc((stride + 1) * bitmap.height);
  for (let y = 0; y < bitmap.height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    bitmap.data.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function inspectWrittenPng(filename, expectedFrames) {
  const png = fs.readFileSync(path.join(__dirname, filename));
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error(`${filename}: invalid PNG signature`);
  }

  let width = 0;
  let height = 0;
  let offset = 8;
  const compressed = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) throw new Error(`${filename}: expected 8-bit RGBA`);
    } else if (type === "IDAT") {
      compressed.push(data);
    }
    offset += length + 12;
  }

  if (width !== expectedFrames * FRAME || height !== FRAME) {
    throw new Error(`${filename}: written size is ${width}x${height}`);
  }
  const raw = zlib.inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  const counts = Array(expectedFrames).fill(0);
  const bounds = Array.from({ length: expectedFrames }, () => ({ minX: FRAME, minY: FRAME, maxX: -1, maxY: -1 }));
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    if (raw[row] !== 0) throw new Error(`${filename}: unsupported PNG row filter`);
    for (let x = 0; x < width; x += 1) {
      if (raw[row + 1 + x * 4 + 3] === 0) continue;
      const frame = Math.floor(x / FRAME);
      const localX = x % FRAME;
      counts[frame] += 1;
      bounds[frame].minX = Math.min(bounds[frame].minX, localX);
      bounds[frame].minY = Math.min(bounds[frame].minY, y);
      bounds[frame].maxX = Math.max(bounds[frame].maxX, localX);
      bounds[frame].maxY = Math.max(bounds[frame].maxY, y);
    }
  }
  if (counts.some((count) => count === 0)) throw new Error(`${filename}: written PNG contains an empty frame`);
  if (bounds.some((box) => box.minX < 8 || box.maxX > 119 || box.maxY > 119)) {
    const boxes = bounds.map((box) => `${box.minX},${box.minY}-${box.maxX},${box.maxY}`);
    throw new Error(`${filename}: sprite exceeds the safe area of a frame (${boxes.join(" | ")})`);
  }
  return { width, height, counts, bounds };
}

function makeSheet(frames) {
  const sheet = new Bitmap(frames.length * FRAME, FRAME);
  frames.forEach((frame, index) => sheet.blit(frame, index * FRAME, 0));
  return sheet;
}

function assertSheet(name, sheet, frameCount) {
  if (sheet.width !== frameCount * FRAME || sheet.height !== FRAME) {
    throw new Error(`${name}: invalid size ${sheet.width}x${sheet.height}`);
  }
  const counts = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const count = sheet.alphaCount(frame * FRAME, 0, FRAME, FRAME);
    if (count === 0) throw new Error(`${name}: frame ${frame + 1} is empty`);
    counts.push(count);
  }
  return counts;
}

function saveSheet(filename, sheet, frameCount) {
  assertSheet(filename, sheet, frameCount);
  fs.writeFileSync(path.join(__dirname, filename), encodePng(sheet));
  const verified = inspectWrittenPng(filename, frameCount);
  const boxes = verified.bounds.map((box) => `${box.minX},${box.minY}-${box.maxX},${box.maxY}`);
  console.log(`${filename}: ${verified.width}x${verified.height}, RGBA, opaque pixels/frame: ${verified.counts.join(", ")}`);
  console.log(`${filename}: alpha bounds/frame: ${boxes.join(" | ")}`);
}

const runSheet = makeSheet(RUN_POSES.map((pose) => drawRobotFrame(pose)));
const idleSheet = makeSheet([0, -1, -2, -1].map((body) => drawRobotFrame({ body }, true)));

saveSheet("hero_run_sheet.png", runSheet, 8);
saveSheet("hero_idle_sheet.png", idleSheet, 4);

