/**
 * KarplusStrongDisplay - Draws a live waveform for the Karplus-Strong output
 * directly onto the main canvas context.
 *
 * Follows the OscilloscopeDisplay pattern: no DOM element, draws at world
 * coordinates in the main CanvasRenderingContext2D render pass, reading
 * time-domain data from the component's own AnalyserNode each frame.
 *
 * Feature: 034-karplus-strong-oscillator
 */

import type { KarplusStrong } from '../../components/generators/KarplusStrong';

const COLOR_BACKGROUND = '#1a1a1a';
const COLOR_BORDER = '#444444';
const COLOR_WAVEFORM = '#00ff00';
const COLOR_CENTER_LINE = '#333333';

export class KarplusStrongDisplay {
  private karplusStrong: KarplusStrong | null;
  private isFrozen: boolean;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;
  private dataArray: Float32Array;

  constructor(x: number, y: number, width: number, height: number, karplusStrong: KarplusStrong) {
    this.karplusStrong = karplusStrong;
    this.isFrozen = false;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;
    this.dataArray = new Float32Array(karplusStrong.getAnalyserFftSize());
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.isFrozen || !this.karplusStrong) return;

    const x = this.baseX;
    const y = this.baseY;
    const w = this.baseWidth;
    const h = this.baseHeight;

    ctx.save();

    ctx.fillStyle = COLOR_BACKGROUND;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Center line
    ctx.strokeStyle = COLOR_CENTER_LINE;
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();

    const fftSize = this.karplusStrong.getAnalyserFftSize();
    if (this.dataArray.length !== fftSize) {
      this.dataArray = new Float32Array(fftSize);
    }
    this.karplusStrong.getWaveformData(this.dataArray);

    ctx.strokeStyle = COLOR_WAVEFORM;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = w / this.dataArray.length;
    let px = x;

    for (let i = 0; i < this.dataArray.length; i++) {
      const sample = this.dataArray[i];
      if (sample === undefined) continue;

      const py = y + (h / 2) * (1 - sample);

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }

      px += sliceWidth;
    }

    ctx.stroke();
    ctx.restore();
  }

  updatePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
  }

  updateSize(width: number, height: number): void {
    this.baseWidth = width;
    this.baseHeight = height;
  }

  setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
  }

  destroy(): void {
    this.karplusStrong = null;
  }
}
