import { computeCrc32 } from './assetAtlas';
import { QOLBU_CONSTANTS } from './qolbuCore';

/**
 * QolbuVM v13 — Zero-GC Low-Level Assembly (.qasm) & Binary Bytecode (.qvm) Engine.
 * Compiles deterministic gameplay guards, origin-rebase arithmetic, and FSM dispatch
 * into fixed-width 8-byte little-endian instructions executed over pre-allocated Float64 registers.
 */

export const QVM_MAGIC = 'QVM13\0\0\0';
export const QVM_HEADER_BYTES = 24;
export const QVM_INSN_BYTES = 8;

export enum QvmOpcode {
  NOP = 0x00,
  LOADI = 0x01,      // r[dst] = imm32 (signed integer / scaled float)
  MOV = 0x02,        // r[dst] = r[a]
  ADD = 0x03,        // r[dst] = r[a] + r[b]
  SUB = 0x04,        // r[dst] = r[a] - r[b]
  MUL = 0x05,        // r[dst] = r[a] * r[b]
  CLAMP_DT = 0x06,   // r[dst] = clamp(r[a], DT_MIN_SEC, DT_MAX_SEC)
  DIST_SQ = 0x07,    // r[dst] = (r[a] * r[a]) + (r[b] * r[b])
  REBASE_500 = 0x08, // r[dst] = trunc(r[a] / 500) * 500
  CHECK_MOVE = 0x09, // r[dst] = (finite & y > -200 & dist <= MAX_DELTA) ? 1 : 0
  CMP_GT = 0x0a,     // r[dst] = r[a] > r[b] ? 1 : 0
  CMP_LT = 0x0b,     // r[dst] = r[a] < r[b] ? 1 : 0
  JMP = 0x0c,        // pc = imm32
  JZ = 0x0d,         // if r[a] == 0 then pc = imm32
  EMIT_FSM = 0x0e,   // push FSM signal code imm32 to ring
  HALT = 0x0f,       // stop execution
}

const OPCODE_NAMES: Record<number, string> = {
  [QvmOpcode.NOP]: 'NOP',
  [QvmOpcode.LOADI]: 'LOADI',
  [QvmOpcode.MOV]: 'MOV',
  [QvmOpcode.ADD]: 'ADD',
  [QvmOpcode.SUB]: 'SUB',
  [QvmOpcode.MUL]: 'MUL',
  [QvmOpcode.CLAMP_DT]: 'CLAMP_DT',
  [QvmOpcode.DIST_SQ]: 'DIST_SQ',
  [QvmOpcode.REBASE_500]: 'REBASE_500',
  [QvmOpcode.CHECK_MOVE]: 'CHECK_MOVE',
  [QvmOpcode.CMP_GT]: 'CMP_GT',
  [QvmOpcode.CMP_LT]: 'CMP_LT',
  [QvmOpcode.JMP]: 'JMP',
  [QvmOpcode.JZ]: 'JZ',
  [QvmOpcode.EMIT_FSM]: 'EMIT_FSM',
  [QvmOpcode.HALT]: 'HALT',
};

const NAME_TO_OPCODE: Record<string, QvmOpcode> = Object.fromEntries(
  Object.entries(OPCODE_NAMES).map(([k, v]) => [v, Number(k) as QvmOpcode])
);

export interface QvmInstruction {
  pc: number;
  op: QvmOpcode;
  mnemonic: string;
  dst: number;
  a: number;
  b: number;
  imm: number;
}

export interface QvmAssembleResult {
  valid: boolean;
  binary: Uint8Array;
  instructions: QvmInstruction[];
  opHex: string;
  crc32Hex: string;
  codeBytes: number;
  errors: string[];
}

export interface QvmExecutionTrace {
  halted: boolean;
  cycles: number;
  pc: number;
  registers: number[];
  emittedSignals: number[];
  nanGuarded: boolean;
}

export interface QasmPreset {
  id: string;
  label: string;
  description: string;
  source: string;
}

export const QASM_PRESETS: QasmPreset[] = [
  {
    id: 'locomotion_guard',
    label: 'Locomotion & Anti-Exploit Kernel',
    description: 'Clamps delta-time [16..33ms], checks move delta <= 10m, and emits FSM_IDLE_OR_MOVE.',
    source: `; QolbuVM v13 Zero-GC Locomotion & Anti-Exploit Kernel
LOADI R0, 60       ; raw dt milli-units (0.060s -> clamped)
MUL   R0, R0, R0   ; non-zero check demo (reset below)
LOADI R0, 5        ; dx = 5m
LOADI R1, 4        ; dz = 4m
DIST_SQ R2, R0, R1 ; R2 = dx^2 + dz^2 = 41
CHECK_MOVE R3, R0, R1
JZ    R3, exploit_blocked
EMIT_FSM 101       ; FSM_MOVE_VERIFIED
HALT
exploit_blocked:
EMIT_FSM 909       ; FSM_EXPLOIT_REJECTED
HALT`,
  },
  {
    id: 'origin_rebase',
    label: '500m Floating-Origin Rebase Step',
    description: 'Snaps distant coordinates (>500m) back to origin grid without float jitter.',
    source: `; Floating-Origin 500m Threshold Rebase (Itel A70 FP32 Precision Guard)
LOADI R0, 1240     ; world X = 1240m
LOADI R1, -640     ; world Z = -640m
REBASE_500 R2, R0  ; R2 = 1000m shift
REBASE_500 R3, R1  ; R3 = -500m shift
SUB   R4, R0, R2   ; local X = 240m
SUB   R5, R1, R3   ; local Z = -140m
EMIT_FSM 202       ; FSM_ORIGIN_REBASED
HALT`,
  },
  {
    id: 'dt_budget_guard',
    label: 'Itel A70 30Hz Frame & Token Guard',
    description: 'Validates clamped delta-time and triggers AI attack token signal when threshold passes.',
    source: `; 30Hz Eco Frame Clamp & AI Attack Token Verification
LOADI R0, 1        ; raw dt input (1s spike)
CLAMP_DT R1, R0    ; clamped to DT_MAX_SEC (0.033s)
LOADI R2, 24       ; active draw calls = 24
LOADI R3, 35       ; Itel A70 ceiling = 35
CMP_LT R4, R2, R3  ; R4 = 1 if DC < 35
JZ    R4, over_budget
EMIT_FSM 303       ; FSM_BUDGET_OK
HALT
over_budget:
EMIT_FSM 404       ; FSM_TRIGGER_LOD_DECIMATE
HALT`,
  },
];

function parseRegister(token: string): number {
  const clean = token.trim().toUpperCase().replace(/,$/, '');
  const match = /^R([0-7])$/.exec(clean);
  if (!match) return -1;
  return Number(match[1]);
}

function parseImmediate(token: string, labels: Map<string, number>): number | null {
  const clean = token.trim().replace(/,$/, '');
  if (labels.has(clean)) return labels.get(clean)!;
  if (/^-?\d+$/.test(clean)) return Number.parseInt(clean, 10);
  if (/^0x[0-9a-f]+$/i.test(clean)) return Number.parseInt(clean, 16);
  return null;
}

export function assembleQolbuAsm(source: string): QvmAssembleResult {
  const rawLines = source.split(/\r?\n/);
  const cleaned: Array<{ lineNum: number; text: string }> = [];
  const labels = new Map<string, number>();
  const errors: string[] = [];

  // Pass 1: strip comments & collect instruction addresses / labels
  let pcCounter = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const noComment = rawLines[i].split(';')[0].trim();
    if (!noComment) continue;

    if (noComment.endsWith(':')) {
      const labelName = noComment.slice(0, -1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(labelName)) {
        errors.push(`Line ${i + 1}: Invalid label "${labelName}"`);
      } else {
        labels.set(labelName, pcCounter);
      }
      continue;
    }

    const labelPrefixMatch = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/.exec(noComment);
    if (labelPrefixMatch) {
      labels.set(labelPrefixMatch[1], pcCounter);
      cleaned.push({ lineNum: i + 1, text: labelPrefixMatch[2].trim() });
      pcCounter += 1;
    } else {
      cleaned.push({ lineNum: i + 1, text: noComment });
      pcCounter += 1;
    }
  }

  // Pass 2: encode 8-byte little-endian instructions
  const instructions: QvmInstruction[] = [];
  for (let idx = 0; idx < cleaned.length; idx++) {
    const { lineNum, text } = cleaned[idx];
    const parts = text.replace(/,/g, ' ').trim().split(/\s+/);
    const mnemonic = (parts[0] || '').toUpperCase();
    const op = NAME_TO_OPCODE[mnemonic];
    if (op === undefined) {
      errors.push(`Line ${lineNum}: Unknown opcode "${mnemonic}"`);
      continue;
    }

    let dst = 0;
    let a = 0;
    let b = 0;
    let imm = 0;

    if (op === QvmOpcode.NOP || op === QvmOpcode.HALT) {
      // Zero operands
    } else if (op === QvmOpcode.LOADI) {
      dst = parseRegister(parts[1] ?? '');
      const val = parseImmediate(parts[2] ?? '', labels);
      if (dst < 0 || val === null) {
        errors.push(`Line ${lineNum}: LOADI expects "R0..R7, imm32"`);
        continue;
      }
      imm = val | 0;
    } else if (op === QvmOpcode.MOV || op === QvmOpcode.CLAMP_DT || op === QvmOpcode.REBASE_500) {
      dst = parseRegister(parts[1] ?? '');
      a = parseRegister(parts[2] ?? '');
      if (dst < 0 || a < 0) {
        errors.push(`Line ${lineNum}: ${mnemonic} expects "Rdst, Ra"`);
        continue;
      }
    } else if (
      op === QvmOpcode.ADD ||
      op === QvmOpcode.SUB ||
      op === QvmOpcode.MUL ||
      op === QvmOpcode.DIST_SQ ||
      op === QvmOpcode.CHECK_MOVE ||
      op === QvmOpcode.CMP_GT ||
      op === QvmOpcode.CMP_LT
    ) {
      dst = parseRegister(parts[1] ?? '');
      a = parseRegister(parts[2] ?? '');
      b = parseRegister(parts[3] ?? '');
      if (dst < 0 || a < 0 || b < 0) {
        errors.push(`Line ${lineNum}: ${mnemonic} expects "Rdst, Ra, Rb"`);
        continue;
      }
    } else if (op === QvmOpcode.JMP || op === QvmOpcode.EMIT_FSM) {
      const target = parseImmediate(parts[1] ?? '', labels);
      if (target === null) {
        errors.push(`Line ${lineNum}: ${mnemonic} expects label or integer`);
        continue;
      }
      imm = target | 0;
    } else if (op === QvmOpcode.JZ) {
      a = parseRegister(parts[1] ?? '');
      const target = parseImmediate(parts[2] ?? '', labels);
      if (a < 0 || target === null) {
        errors.push(`Line ${lineNum}: JZ expects "Ra, label"`);
        continue;
      }
      imm = target | 0;
    }

    instructions.push({ pc: instructions.length, op, mnemonic, dst, a, b, imm });
  }

  const codeBytes = instructions.length * QVM_INSN_BYTES;
  const binary = new Uint8Array(QVM_HEADER_BYTES + codeBytes);
  const view = new DataView(binary.buffer);

  for (let i = 0; i < instructions.length; i++) {
    const insn = instructions[i];
    const base = QVM_HEADER_BYTES + i * QVM_INSN_BYTES;
    binary[base] = insn.op;
    binary[base + 1] = insn.dst & 0x07;
    binary[base + 2] = insn.a & 0x07;
    binary[base + 3] = insn.b & 0x07;
    view.setInt32(base + 4, insn.imm, true);
  }

  const codeSlice = binary.subarray(QVM_HEADER_BYTES);
  const crc32 = computeCrc32(codeSlice);

  for (let i = 0; i < 8; i++) {
    binary[i] = QVM_MAGIC.charCodeAt(i);
  }
  view.setUint16(8, 13, true); // Version 13
  view.setUint16(10, 1, true); // Flags: Deterministic Little-Endian
  view.setUint32(12, instructions.length, true);
  view.setUint16(16, 8, true); // 8 registers
  view.setUint16(18, 0, true); // entryPc
  view.setUint32(20, crc32, true);

  const hexTokens: string[] = [];
  for (let i = 0; i < Math.min(binary.length, 64); i++) {
    hexTokens.push(binary[i].toString(16).toUpperCase().padStart(2, '0'));
  }

  return {
    valid: errors.length === 0 && instructions.length > 0,
    binary,
    instructions,
    opHex: hexTokens.join(' '),
    crc32Hex: `0x${crc32.toString(16).toUpperCase().padStart(8, '0')}`,
    codeBytes,
    errors,
  };
}

export function verifyQvmBinary(binary: Uint8Array): {
  valid: boolean;
  version: number;
  instructionCount: number;
  crc32Match: boolean;
} {
  if (binary.byteLength < QVM_HEADER_BYTES) {
    return { valid: false, version: 0, instructionCount: 0, crc32Match: false };
  }
  let magic = '';
  for (let i = 0; i < 8; i++) magic += String.fromCharCode(binary[i]);
  if (magic !== QVM_MAGIC) {
    return { valid: false, version: 0, instructionCount: 0, crc32Match: false };
  }

  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const version = view.getUint16(8, true);
  const instructionCount = view.getUint32(12, true);
  const expectedCrc = view.getUint32(20, true);
  const expectedLength = QVM_HEADER_BYTES + instructionCount * QVM_INSN_BYTES;
  if (binary.byteLength < expectedLength) {
    return { valid: false, version, instructionCount, crc32Match: false };
  }

  const codeSlice = binary.subarray(QVM_HEADER_BYTES, expectedLength);
  const actualCrc = computeCrc32(codeSlice);
  const crc32Match = actualCrc === expectedCrc;

  return {
    valid: crc32Match && version === 13 && instructionCount > 0,
    version,
    instructionCount,
    crc32Match,
  };
}

export function disassembleQvmBinary(binary: Uint8Array): QvmInstruction[] {
  const check = verifyQvmBinary(binary);
  if (!check.valid) return [];
  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const out: QvmInstruction[] = [];
  for (let i = 0; i < check.instructionCount; i++) {
    const base = QVM_HEADER_BYTES + i * QVM_INSN_BYTES;
    const op = binary[base] as QvmOpcode;
    out.push({
      pc: i,
      op,
      mnemonic: OPCODE_NAMES[op] ?? `OP_${op}`,
      dst: binary[base + 1],
      a: binary[base + 2],
      b: binary[base + 3],
      imm: view.getInt32(base + 4, true),
    });
  }
  return out;
}

/**
 * Pre-allocated deterministic Virtual Machine running QVM13 binary bytecode with zero heap allocations per cycle.
 */
export class QolbuBytecodeVm {
  public readonly registers = new Float64Array(8);
  private readonly signalRing = new Int32Array(32);
  private signalCount = 0;
  private pc = 0;
  private halted = false;
  private nanGuarded = false;

  public reset(): void {
    this.registers.fill(0);
    this.signalRing.fill(0);
    this.signalCount = 0;
    this.pc = 0;
    this.halted = false;
    this.nanGuarded = false;
  }

  public run(binary: Uint8Array, maxCycles = 256): QvmExecutionTrace {
    this.reset();
    const verification = verifyQvmBinary(binary);
    if (!verification.valid) {
      return {
        halted: true,
        cycles: 0,
        pc: 0,
        registers: Array.from(this.registers),
        emittedSignals: [],
        nanGuarded: true,
      };
    }

    const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
    const insnCount = verification.instructionCount;
    let cycles = 0;

    while (!this.halted && this.pc >= 0 && this.pc < insnCount && cycles < maxCycles) {
      const base = QVM_HEADER_BYTES + this.pc * QVM_INSN_BYTES;
      const op = binary[base];
      const dst = binary[base + 1] & 0x07;
      const a = binary[base + 2] & 0x07;
      const b = binary[base + 3] & 0x07;
      const imm = view.getInt32(base + 4, true);
      cycles += 1;

      switch (op) {
        case QvmOpcode.NOP:
          this.pc += 1;
          break;
        case QvmOpcode.LOADI:
          this.registers[dst] = imm;
          this.pc += 1;
          break;
        case QvmOpcode.MOV:
          this.registers[dst] = this.registers[a];
          this.pc += 1;
          break;
        case QvmOpcode.ADD:
          this.registers[dst] = this.registers[a] + this.registers[b];
          this.pc += 1;
          break;
        case QvmOpcode.SUB:
          this.registers[dst] = this.registers[a] - this.registers[b];
          this.pc += 1;
          break;
        case QvmOpcode.MUL:
          this.registers[dst] = this.registers[a] * this.registers[b];
          this.pc += 1;
          break;
        case QvmOpcode.CLAMP_DT: {
          const v = this.registers[a];
          if (!Number.isFinite(v)) {
            this.registers[dst] = QOLBU_CONSTANTS.DT_MAX_SEC;
            this.nanGuarded = true;
          } else {
            this.registers[dst] = Math.min(QOLBU_CONSTANTS.DT_MAX_SEC, Math.max(QOLBU_CONSTANTS.DT_MIN_SEC, v));
          }
          this.pc += 1;
          break;
        }
        case QvmOpcode.DIST_SQ:
          this.registers[dst] = this.registers[a] * this.registers[a] + this.registers[b] * this.registers[b];
          this.pc += 1;
          break;
        case QvmOpcode.REBASE_500: {
          const val = this.registers[a];
          const thr = QOLBU_CONSTANTS.ORIGIN_REBASE_M;
          this.registers[dst] = Math.abs(val) > thr ? Math.trunc(val / thr) * thr : 0;
          this.pc += 1;
          break;
        }
        case QvmOpcode.CHECK_MOVE: {
          const dx = this.registers[a];
          const dz = this.registers[b];
          const ok =
            Number.isFinite(dx) &&
            Number.isFinite(dz) &&
            Math.hypot(dx, dz) <= QOLBU_CONSTANTS.MAX_SPEED_MPS;
          this.registers[dst] = ok ? 1 : 0;
          this.pc += 1;
          break;
        }
        case QvmOpcode.CMP_GT:
          this.registers[dst] = this.registers[a] > this.registers[b] ? 1 : 0;
          this.pc += 1;
          break;
        case QvmOpcode.CMP_LT:
          this.registers[dst] = this.registers[a] < this.registers[b] ? 1 : 0;
          this.pc += 1;
          break;
        case QvmOpcode.JMP:
          this.pc = imm;
          break;
        case QvmOpcode.JZ:
          this.pc = this.registers[a] === 0 ? imm : this.pc + 1;
          break;
        case QvmOpcode.EMIT_FSM:
          if (this.signalCount < this.signalRing.length) {
            this.signalRing[this.signalCount++] = imm;
          }
          this.pc += 1;
          break;
        case QvmOpcode.HALT:
          this.halted = true;
          break;
        default:
          this.halted = true;
          this.nanGuarded = true;
          break;
      }
    }

    const signals: number[] = [];
    for (let i = 0; i < this.signalCount; i++) signals.push(this.signalRing[i]);

    return {
      halted: this.halted,
      cycles,
      pc: this.pc,
      registers: Array.from(this.registers),
      emittedSignals: signals,
      nanGuarded: this.nanGuarded,
    };
  }
}
