import type { AtlasTileSpec, GameRuntimeConfig, StudioProjectState, StyleBibleSpec } from './types';

/**
 * Qolbu Asset Atlas, Texture Compression & Binary (.qbin) Packager.
 * Adopts sprite/UV atlas packing (PixiJS pattern) + RLE binary compression + CRC32 verification
 * for sub-280MB Itel A70 memory envelopes and Android 5+ APK bundling.
 */

export const QBIN_MAGIC = 'QBIN13\0\0';

export function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Lossless Run-Length Encoding for binary game payloads (tilemaps, LUTs, state snapshots).
 * Format: [markerByte(0x80 | runLen-1), valueByte] for runs >= 2,
 *         [literalCount-1 (0..127), ...literalBytes] for non-repeating runs.
 */
export function compressBinaryRle(input: Uint8Array): Uint8Array {
  if (input.length === 0) return new Uint8Array(0);
  const out: number[] = [];
  let i = 0;

  while (i < input.length) {
    let runLen = 1;
    while (i + runLen < input.length && runLen < 128 && input[i + runLen] === input[i]) {
      runLen += 1;
    }

    if (runLen >= 3) {
      out.push(0x80 | (runLen - 1), input[i]);
      i += runLen;
    } else {
      const litStart = i;
      let litLen = 0;
      while (i < input.length && litLen < 128) {
        let nextRun = 1;
        while (i + nextRun < input.length && nextRun < 3 && input[i + nextRun] === input[i]) {
          nextRun += 1;
        }
        if (nextRun >= 3 && litLen > 0) break;
        litLen += 1;
        i += 1;
      }
      out.push(litLen - 1);
      for (let j = 0; j < litLen; j++) {
        out.push(input[litStart + j]);
      }
    }
  }

  return new Uint8Array(out);
}

export function decompressBinaryRle(compressed: Uint8Array, expectedSize?: number): Uint8Array {
  const out: number[] = [];
  let i = 0;

  while (i < compressed.length) {
    const ctrl = compressed[i++];
    if ((ctrl & 0x80) !== 0) {
      const runLen = (ctrl & 0x7f) + 1;
      const val = compressed[i++] ?? 0;
      for (let r = 0; r < runLen; r++) out.push(val);
    } else {
      const litLen = ctrl + 1;
      for (let l = 0; l < litLen && i < compressed.length; l++) {
        out.push(compressed[i++]);
      }
    }
  }

  if (typeof expectedSize === 'number' && out.length !== expectedSize) {
    throw new Error(`QBIN RLE size mismatch: expected ${expectedSize}, got ${out.length}`);
  }
  return new Uint8Array(out);
}

export function createStudioTextureAtlasSpec(
  styleBible: StyleBibleSpec,
  runtimeConfig: GameRuntimeConfig
): {
  atlasWidth: number;
  atlasHeight: number;
  compressionFormat: string;
  estimatedVramKb: number;
  tiles: AtlasTileSpec[];
} {
  const tiles: AtlasTileSpec[] = [
    {
      id: 'stone_floor',
      label: 'Terrain Basalt Tile',
      u: 0,
      v: 0,
      w: 0.5,
      h: 0.5,
      hex: runtimeConfig.groundHex,
      roughness: 0.86,
    },
    {
      id: 'pillar_trim',
      label: 'Sanctuary Pillar & Trim',
      u: 0.5,
      v: 0,
      w: 0.5,
      h: 0.5,
      hex: styleBible.palette[1]?.hex ?? runtimeConfig.groundHex,
      roughness: 0.42,
    },
    {
      id: 'shard_crystal',
      label: 'Resonance Shard Core',
      u: 0,
      v: 0.5,
      w: 0.25,
      h: 0.5,
      hex: runtimeConfig.accentHex,
      roughness: 0.14,
    },
    {
      id: 'hazard_rune',
      label: 'Sentinel Telegraph Ring',
      u: 0.25,
      v: 0.5,
      w: 0.25,
      h: 0.5,
      hex: runtimeConfig.hazardHex,
      roughness: 0.2,
    },
    {
      id: 'gate_emerald',
      label: 'Sanctuary Gate Seal',
      u: 0.5,
      v: 0.5,
      w: 0.5,
      h: 0.5,
      hex: runtimeConfig.nominalHex,
      roughness: 0.22,
    },
  ];

  return {
    atlasWidth: 512,
    atlasHeight: 512,
    compressionFormat: 'ASTC_6x6_UNORM',
    estimatedVramKb: 118, // 512x512 @ 3.56 bpp ASTC 6x6
    tiles,
  };
}

/**
 * Packs a StudioProjectState into a verified .qbin binary archive with deterministic header + CRC32.
 * Header Layout (28 bytes Little-Endian):
 *   0..7   : Magic "QBIN13\0\0"
 *   8..9   : Version u16 (13)
 *   10..11 : Flags u16 (1 = RLE compressed)
 *   12..13 : MaxEntities u16 (128)
 *   14..15 : MaxParticles u16 (64)
 *   16..19 : UncompressedSize u32
 *   20..23 : CompressedSize u32
 *   24..27 : PayloadCRC32 u32
 */
export function packGameBinaryBundle(project: StudioProjectState): {
  bytes: Uint8Array;
  headerSummary: {
    magic: string;
    version: number;
    uncompressedBytes: number;
    compressedBytes: number;
    ratioPct: number;
    crc32Hex: string;
  };
} {
  const atlas = createStudioTextureAtlasSpec(project.styleBible, project.runtimeConfig);
  const manifest = JSON.stringify({
    engine: 'MungilEngine-V13-Qolbu',
    title: project.brief.title,
    genre: project.brief.genre,
    runtimeConfig: project.runtimeConfig,
    atlas,
    fsm: {
      name: project.stateMachine.name,
      nodes: project.stateMachine.nodes.map((n) => ({ id: n.id, hook: n.scriptHook })),
      transitions: project.stateMachine.transitions.map((t) => ({
        from: t.from,
        to: t.to,
        trigger: t.trigger,
        guard: t.guardExpr,
        blendMs: t.blendMs,
      })),
    },
  });

  const rawBytes = new TextEncoder().encode(manifest);
  const compressed = compressBinaryRle(rawBytes);
  const crc32 = computeCrc32(rawBytes);

  const headerSize = 28;
  const bundle = new Uint8Array(headerSize + compressed.length);
  const view = new DataView(bundle.buffer);

  for (let i = 0; i < 8; i++) {
    bundle[i] = QBIN_MAGIC.charCodeAt(i);
  }
  view.setUint16(8, 13, true);
  view.setUint16(10, 1, true); // Bit 0: RLE compressed
  view.setUint16(12, 128, true);
  view.setUint16(14, 64, true);
  view.setUint32(16, rawBytes.length, true);
  view.setUint32(20, compressed.length, true);
  view.setUint32(24, crc32, true);
  bundle.set(compressed, headerSize);

  return {
    bytes: bundle,
    headerSummary: {
      magic: 'QBIN13',
      version: 13,
      uncompressedBytes: rawBytes.length,
      compressedBytes: compressed.length,
      ratioPct: Number(((compressed.length / Math.max(1, rawBytes.length)) * 100).toFixed(1)),
      crc32Hex: `0x${crc32.toString(16).toUpperCase().padStart(8, '0')}`,
    },
  };
}

export function verifyQbinBundle(bundle: Uint8Array): {
  valid: boolean;
  version: number;
  crc32Match: boolean;
  manifestJson: string;
} {
  if (bundle.byteLength < 28) {
    return { valid: false, version: 0, crc32Match: false, manifestJson: '' };
  }
  let magic = '';
  for (let i = 0; i < 8; i++) magic += String.fromCharCode(bundle[i]);
  if (magic !== QBIN_MAGIC) {
    return { valid: false, version: 0, crc32Match: false, manifestJson: '' };
  }

  const view = new DataView(bundle.buffer, bundle.byteOffset, bundle.byteLength);
  const version = view.getUint16(8, true);
  const uncompressedSize = view.getUint32(16, true);
  const compressedSize = view.getUint32(20, true);
  const expectedCrc = view.getUint32(24, true);

  const payload = bundle.subarray(28, 28 + compressedSize);
  const restored = decompressBinaryRle(payload, uncompressedSize);
  const actualCrc = computeCrc32(restored);
  const crc32Match = actualCrc === expectedCrc;
  const manifestJson = new TextDecoder().decode(restored);

  return {
    valid: crc32Match && version === 13,
    version,
    crc32Match,
    manifestJson,
  };
}
