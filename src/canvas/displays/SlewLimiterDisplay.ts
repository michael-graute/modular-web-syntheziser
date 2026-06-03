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

export class SlewLimiterDisplay {
  private slewLimiter: SlewLimiter | null;
  private isFrozen: boolean;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;

  private lastFrameTime: number = 0;

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
    const level = this.slewLimiter.getOutputValue();
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
    }
  }

  destroy(): void {
    this.slewLimiter = null;
  }
}
