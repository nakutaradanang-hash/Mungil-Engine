import type { AudioScaleId } from './types';

const SCALE_NOTES: Record<AudioScaleId, { explore: number[]; combat: number[] }> = {
  pentatonic: {
    explore: [220.0, 261.63, 293.66, 329.63, 392.0, 329.63, 293.66, 261.63],
    combat: [220.0, 261.63, 329.63, 440.0, 392.0, 329.63, 293.66, 220.0],
  },
  cyber_minor: {
    explore: [196.0, 233.08, 261.63, 293.66, 349.23, 293.66, 233.08, 174.61],
    combat: [196.0, 196.0, 261.63, 311.13, 392.0, 349.23, 311.13, 261.63],
  },
  heroic_major: {
    explore: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0],
    combat: [261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 440.0, 523.25],
  },
  tension_phrygian: {
    explore: [164.81, 174.61, 207.65, 220.0, 246.94, 220.0, 174.61, 164.81],
    combat: [164.81, 174.61, 220.0, 261.63, 246.94, 207.65, 174.61, 164.81],
  },
};

export type QolbuSfxKind =
  | 'jump'
  | 'dash'
  | 'pickup'
  | 'hit'
  | 'parry'
  | 'step'
  | 'telegraph'
  | 'victory'
  | 'gameover'
  | 'dialog'
  | 'click';

class QolbuAudioSynth {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private muted = false;
  private bgmVolume = 0.75;
  private sfxVolume = 0.9;
  private bgmPlaying = false;
  private bgmTimer: number | null = null;
  private stepIdx = 0;
  private intensity: 'explore' | 'combat' = 'explore';
  private scaleId: AudioScaleId = 'pentatonic';
  private tempoBpm = 112;
  private activeVoices = 0;
  private readonly MAX_VOICES = 16;
  private visibilityHooked = false;

  private ensureVisibilityListener() {
    if (this.visibilityHooked || typeof document === 'undefined') return;
    this.visibilityHooked = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.bgmPlaying) {
        this.stopMusic();
      }
    });
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    this.ensureVisibilityListener();
    if (!this.ctx || this.ctx.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);
      this.compressor.connect(this.ctx.destination);

      this.bgmBus = this.ctx.createGain();
      this.bgmBus.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
      this.bgmBus.connect(this.compressor);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxBus.connect(this.compressor);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  configureAudio(opts: { tempoBpm?: number; scale?: AudioScaleId }) {
    const nextBpm = Number.isFinite(opts.tempoBpm)
      ? Math.min(180, Math.max(68, Number(opts.tempoBpm)))
      : this.tempoBpm;
    const nextScale = opts.scale ?? this.scaleId;
    const changed = nextBpm !== this.tempoBpm || nextScale !== this.scaleId;
    this.tempoBpm = nextBpm;
    this.scaleId = nextScale;
    if (changed && this.bgmPlaying) {
      this.stopMusic();
      this.startMusic();
    }
  }

  setVolumes(opts: { bgm?: number; sfx?: number }) {
    if (typeof opts.bgm === 'number' && Number.isFinite(opts.bgm)) {
      this.bgmVolume = Math.min(1, Math.max(0, opts.bgm));
      if (this.bgmBus && this.ctx && this.ctx.state !== 'closed') {
        this.bgmBus.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
      }
    }
    if (typeof opts.sfx === 'number' && Number.isFinite(opts.sfx)) {
      this.sfxVolume = Math.min(1, Math.max(0, opts.sfx));
      if (this.sfxBus && this.ctx && this.ctx.state !== 'closed') {
        this.sfxBus.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      }
    }
  }

  getVolumes(): { bgm: number; sfx: number } {
    return { bgm: this.bgmVolume, sfx: this.sfxVolume };
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stopMusic();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setIntensity(mode: 'explore' | 'combat') {
    this.intensity = mode;
  }

  getActiveVoiceCount(): number {
    return this.activeVoices;
  }

  playSfx(kind: QolbuSfxKind) {
    if (this.muted || this.sfxVolume <= 0.01 || this.activeVoices >= this.MAX_VOICES) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const jitter = 0.94 + Math.random() * 0.12;

    this.activeVoices += 1;
    let stopOffset = 0.06;

    if (kind === 'pickup') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(1040 * jitter, now + 0.14);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      stopOffset = 0.18;
    } else if (kind === 'jump') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(210 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(480 * jitter, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      stopOffset = 0.15;
    } else if (kind === 'dash') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.11);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      stopOffset = 0.13;
    } else if (kind === 'parry') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(740 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.22);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      stopOffset = 0.25;
    } else if (kind === 'hit') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(145 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.16);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      stopOffset = 0.19;
    } else if (kind === 'step') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.045);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      stopOffset = 0.055;
    } else if (kind === 'telegraph') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.18);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      stopOffset = 0.2;
    } else if (kind === 'victory') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.1);
      osc.frequency.setValueAtTime(659.25, now + 0.2);
      osc.frequency.setValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      stopOffset = 0.56;
    } else if (kind === 'gameover') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(174.61, now + 0.14);
      osc.frequency.setValueAtTime(130.81, now + 0.28);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      stopOffset = 0.52;
    } else if (kind === 'dialog') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540 * jitter, now);
      osc.frequency.setValueAtTime(680 * jitter, now + 0.04);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      stopOffset = 0.1;
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      stopOffset = 0.06;
    }

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + stopOffset);
  }

  startMusic() {
    if (this.muted || this.bgmPlaying || typeof window === 'undefined') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmBus) return;
    this.bgmPlaying = true;

    const intervalMs = Math.round((60 / this.tempoBpm) * 500);

    this.bgmTimer = window.setInterval(() => {
      if (
        this.muted ||
        this.bgmVolume <= 0.01 ||
        !this.bgmPlaying ||
        !this.ctx ||
        !this.bgmBus ||
        this.activeVoices >= this.MAX_VOICES
      ) {
        return;
      }
      const bank = SCALE_NOTES[this.scaleId] ?? SCALE_NOTES.pentatonic;
      const scale = this.intensity === 'combat' ? bank.combat : bank.explore;
      const freq = scale[this.stepIdx % scale.length];
      const isDownbeat = this.stepIdx % 4 === 0;
      this.stepIdx += 1;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.intensity === 'combat' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(this.intensity === 'combat' ? 0.048 : 0.032, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.bgmBus);
      this.activeVoices += 1;
      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.25);

      // Subtle sub-octave bass root pulse on downbeats when headroom allows
      if (isDownbeat && this.activeVoices < this.MAX_VOICES - 2) {
        const bass = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(freq * 0.5, now);
        bassGain.gain.setValueAtTime(this.intensity === 'combat' ? 0.065 : 0.04, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        bass.connect(bassGain);
        bassGain.connect(this.bgmBus);
        this.activeVoices += 1;
        bass.onended = () => {
          this.activeVoices = Math.max(0, this.activeVoices - 1);
          bass.disconnect();
          bassGain.disconnect();
        };
        bass.start(now);
        bass.stop(now + 0.36);
      }
    }, intervalMs);
  }

  stopMusic() {
    this.bgmPlaying = false;
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  dispose() {
    this.stopMusic();
    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }
    this.bgmBus = null;
    this.sfxBus = null;
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close();
    }
    this.ctx = null;
    this.activeVoices = 0;
  }
}

export const qolbuAudio = new QolbuAudioSynth();
