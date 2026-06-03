/**
 * EnvelopeFollowerDisplay - Draws a vertical bar meter for the Envelope Follower
 * directly onto the main canvas context.
 *
 * Follows the VuMeterDisplay pattern: no DOM element, draws at world coordinates
 * in the main CanvasRenderingContext2D render pass.
 *
 * Also drives the tick() loop: records frame delta from performance.now() and
 * calls envelopeFollower.tick(dt) each frame so the IIR smoother advances.
 *
 * Feature: 030-envelope-follower
 */

import type { EnvelopeFollower } from '../../components/analyzers/EnvelopeFollower';

const COLOR_BAR = '#22c55e';
const COLOR_BACKGROUND = '#1a1a1a';
const COLOR_BORDER = '#444444';

export class EnvelopeFollowerDisplay {
  private envelopeFollower: EnvelopeFollower | null;
  private isFrozen: boolean;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;

  private lastFrameTime: number = 0;

  constructor(x: number, y: number, width: number, height: number, envelopeFollower: EnvelopeFollower) {
    this.envelopeFollower = envelopeFollower;
    this.isFrozen = false;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.isFrozen || !this.envelopeFollower) return;

    // Advance the envelope by one frame
    const now = performance.now();
    const dtMs = this.lastFrameTime === 0 ? 16 : now - this.lastFrameTime;
    this.lastFrameTime = now;
    // clamp dt to 100 ms max to prevent envelope jump after tab-switch wakeup
    const dtSec = Math.min(dtMs / 1000, 0.1);
    this.envelopeFollower.tick(dtSec);

    const x = this.baseX;
    const y = this.baseY;
    const w = this.baseWidth;
    const h = this.baseHeight;

    ctx.save();

    // Background
    ctx.fillStyle = COLOR_BACKGROUND;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Bar — fills upward from the bottom, proportional to envelopeValue [0, 1]
    const padding = 4;
    const innerW = w - padding * 2;
    const innerH = h - padding * 2;
    const level = this.envelopeFollower.getEnvelopeValue();
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
    this.envelopeFollower = null;
  }
}
