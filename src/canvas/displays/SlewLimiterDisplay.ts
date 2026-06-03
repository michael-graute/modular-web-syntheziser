/**
 * SlewLimiterDisplay - Draws a vertical bar meter for the Slew Limiter output.
 *
 * Follows the EnvelopeFollowerDisplay pattern: no DOM element, draws at world
 * coordinates in the main CanvasRenderingContext2D render pass.
 *
 * Also drives the tick() loop: records frame delta from performance.now() and
 * calls slewLimiter.tick(dt) each frame so the IIR smoother advances.
 *
 * Feature: 031-slew-limiter-portamento
 */

import type { SlewLimiter } from '../../components/utilities/SlewLimiter';

const COLOR_BAR = '#22c55e';
const COLOR_BACKGROUND = '#1a1a1a';
const COLOR_BORDER = '#444444';

// Dynamic range: track observed min/max and normalise the bar against them.
// Resets slowly toward the observed signal to avoid permanent lock-out.
const RANGE_DECAY = 0.002; // fraction per frame the range contracts toward signal

export class SlewLimiterDisplay {
  private slewLimiter: SlewLimiter | null;
  private isFrozen: boolean;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;

  private lastFrameTime: number = 0;
  private observedMin: number = 0;
  private observedMax: number = 1;

  constructor(x: number, y: number, width: number, height: number, slewLimiter: SlewLimiter) {
    this.slewLimiter = slewLimiter;
    this.isFrozen = false;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.isFrozen || !this.slewLimiter) return;

    const now = performance.now();
    const dtMs = this.lastFrameTime === 0 ? 16 : now - this.lastFrameTime;
    this.lastFrameTime = now;
    const dtSec = Math.min(dtMs / 1000, 0.1);
    this.slewLimiter.tick(dtSec);

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

    const padding = 4;
    const innerW = w - padding * 2;
    const innerH = h - padding * 2;
    const raw = this.slewLimiter.getOutputValue();

    // Expand observed range to include new value
    if (raw > this.observedMax) this.observedMax = raw;
    if (raw < this.observedMin) this.observedMin = raw;

    // Slowly contract range toward observed signal so the bar uses full height over time
    this.observedMax -= (this.observedMax - raw) * RANGE_DECAY;
    this.observedMin += (raw - this.observedMin) * RANGE_DECAY;

    // Ensure minimum range to avoid division by zero
    const span = Math.max(this.observedMax - this.observedMin, 1);
    const level = Math.min(1, Math.max(0, (raw - this.observedMin) / span));
    const barH = Math.max(0, level * innerH);

    if (barH > 0) {
      ctx.fillStyle = COLOR_BAR;
      ctx.fillRect(
        x + padding,
        y + padding + innerH - barH,
        innerW,
        barH
      );
    }

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
    if (frozen) {
      this.lastFrameTime = 0;
      this.observedMin = 0;
      this.observedMax = 1;
    }
  }

  destroy(): void {
    this.slewLimiter = null;
  }
}
