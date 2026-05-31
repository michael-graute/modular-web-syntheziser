/**
 * VuMeterDisplay - Draws a segmented peak-level meter directly onto the main canvas context.
 *
 * Follows the OscilloscopeDisplay pattern: no DOM element, draws at world coordinates
 * in the main CanvasRenderingContext2D render pass.
 */

import type { VuMeter } from '../../components/analyzers/VuMeter';

const SEGMENT_COUNT = 20;
const GREEN_SEGMENTS = 12;
const YELLOW_SEGMENTS = 5;
// RED_SEGMENTS = 3 (top 3 = indices 17–19)
const PEAK_HOLD_DURATION_MS = 1500;
const PEAK_DECAY_RATE = 0.02;

const COLOR_GREEN = '#22c55e';
const COLOR_YELLOW = '#eab308';
const COLOR_RED = '#ef4444';
const COLOR_INACTIVE = '#2a2a2a';
const COLOR_PEAK_HOLD = '#ffffff';
const COLOR_BACKGROUND = '#1a1a1a';
const COLOR_BORDER = '#444444';

export class VuMeterDisplay {
  private vuMeter: VuMeter | null;
  private isFrozen: boolean;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;

  private peakHoldLevel: number;
  private peakHoldTimestamp: number;

  constructor(x: number, y: number, width: number, height: number, vuMeter: VuMeter) {
    this.vuMeter = vuMeter;
    this.isFrozen = false;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;
    this.peakHoldLevel = 0;
    this.peakHoldTimestamp = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.isFrozen) return;

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

    const currentLevel = this.vuMeter ? this.vuMeter.getPeakLevel() : 0;
    const now = performance.now();

    if (currentLevel >= this.peakHoldLevel) {
      this.peakHoldLevel = currentLevel;
      this.peakHoldTimestamp = now;
    } else if (now - this.peakHoldTimestamp > PEAK_HOLD_DURATION_MS) {
      this.peakHoldLevel = Math.max(0, this.peakHoldLevel - PEAK_DECAY_RATE);
    }

    const padding = 4;
    const segmentGap = 2;
    const innerW = w - padding * 2;
    const innerH = h - padding * 2;
    const segmentH = (innerH - segmentGap * (SEGMENT_COUNT - 1)) / SEGMENT_COUNT;

    const litCount = Math.round(currentLevel * SEGMENT_COUNT);
    const peakSegment = Math.round(this.peakHoldLevel * SEGMENT_COUNT) - 1;

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const segIndex = SEGMENT_COUNT - 1 - i; // 0 = top, 19 = bottom
      const segY = y + padding + i * (segmentH + segmentGap);
      const segX = x + padding;
      const isLit = segIndex < litCount;
      const isPeakHold = segIndex === peakSegment && this.peakHoldLevel > 0;

      let color: string;
      if (isPeakHold) {
        color = COLOR_PEAK_HOLD;
      } else if (isLit) {
        if (segIndex >= GREEN_SEGMENTS + YELLOW_SEGMENTS) {
          color = COLOR_RED;
        } else if (segIndex >= GREEN_SEGMENTS) {
          color = COLOR_YELLOW;
        } else {
          color = COLOR_GREEN;
        }
      } else {
        color = COLOR_INACTIVE;
      }

      ctx.fillStyle = color;
      ctx.fillRect(segX, segY, innerW, segmentH);
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
  }

  destroy(): void {
    this.vuMeter = null;
  }
}
