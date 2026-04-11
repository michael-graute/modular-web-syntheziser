/**
 * OscilloscopeDisplay - Draws oscilloscope visualization directly onto the main canvas context.
 *
 * Follows the ChordFinderDisplay pattern: no overlay DOM element, no scheduler subscription,
 * draws at world coordinates in the main CanvasRenderingContext2D render pass.
 */

import type { Oscilloscope } from '../../components/analyzers/Oscilloscope';

/**
 * Display renderer for oscilloscope visualization.
 * Draws directly on the main canvas — no HTML element owned.
 */
export class OscilloscopeDisplay {
  private oscilloscope: Oscilloscope | null;
  private isFrozen: boolean;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;

  // 30 FPS throttle (timestamp-based, no external scheduler)
  private lastRenderTime: number;
  private readonly frameInterval: number;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    oscilloscope: Oscilloscope
  ) {
    this.oscilloscope = oscilloscope;
    this.isFrozen = false;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;
    this.lastRenderTime = 0;
    this.frameInterval = 1000 / 30; // ~33 ms
  }

  /**
   * Draw the oscilloscope visualization onto the main canvas context.
   * Internally throttles to ~30 FPS; returns immediately on skipped frames.
   * No-ops when isFrozen is true.
   *
   * @param ctx - The main CanvasRenderingContext2D (viewport transform already applied)
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.isFrozen) return;

    const x = this.baseX;
    const y = this.baseY;
    const w = this.baseWidth;
    const h = this.baseHeight;

    ctx.save();

    // Background and border — always drawn every frame so the display area
    // is never blank between throttled waveform updates.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Throttle expensive waveform/spectrum drawing to ~30 FPS
    const now = performance.now();
    if (now - this.lastRenderTime >= this.frameInterval) {
      this.lastRenderTime = now;

      // Grid
      this.drawGrid(ctx, x, y, w, h);

      // Render based on display mode
      const displayModeParam = this.oscilloscope?.getParameter('displayMode');
      const displayMode = displayModeParam ? Math.round(displayModeParam.getValue()) : 0;

      switch (displayMode) {
        case 0: // Waveform only
          this.renderWaveform(ctx, x, y, w, h);
          break;
        case 1: // Spectrum only
          this.renderSpectrum(ctx, x, y, w, h);
          break;
        case 2: { // Both (split view)
          const halfH = h / 2;
          this.renderWaveform(ctx, x, y, w, halfH);
          this.renderSpectrum(ctx, x, y + halfH, w, halfH);
          break;
        }
      }
    }

    ctx.restore();
  }

  /**
   * Draw grid lines at world coordinates.
   */
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;

    // Vertical grid lines (8 divisions)
    for (let i = 1; i < 8; i++) {
      const gx = x + i * (w / 8);
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }

    // Horizontal grid lines (6 divisions)
    for (let i = 1; i < 6; i++) {
      const gy = y + i * (h / 6);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    // Center line (brighter)
    ctx.strokeStyle = '#555555';
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
  }

  /**
   * Render waveform (time-domain) at world coordinates.
   */
  private renderWaveform(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const data = this.oscilloscope?.getWaveformData();
    if (!data || data.length === 0) return;

    const gainParam = this.oscilloscope?.getParameter('gain');
    const gain = gainParam ? gainParam.getValue() : 1.0;

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = w / data.length;
    let px = x;

    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      if (sample === undefined) continue;

      const v = sample * gain;
      const py = y + (h / 2) * (1 - v);

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }

      px += sliceWidth;
    }

    ctx.stroke();
  }

  /**
   * Render spectrum (frequency-domain) at world coordinates.
   */
  private renderSpectrum(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const data = this.oscilloscope?.getSpectrumData();
    if (!data || data.length === 0) return;

    const barWidth = w / data.length;

    ctx.fillStyle = '#00aaff';

    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      if (sample === undefined) continue;

      const barHeight = (sample / 255) * h;
      const bx = x + i * barWidth;
      const by = y + h - barHeight;

      ctx.fillRect(bx, by, barWidth - 1, barHeight);
    }
  }

  /**
   * Update the world-space origin of the display area.
   * Called by CanvasComponent whenever the parent component moves.
   */
  updatePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
  }

  /**
   * Update the display area dimensions.
   */
  updateSize(width: number, height: number): void {
    this.baseWidth = width;
    this.baseHeight = height;
  }

  /**
   * Enable or disable freeze mode.
   * When frozen, render() skips all drawing.
   */
  setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
  }

  /**
   * Release internal references. Does NOT remove any DOM element.
   * Safe to call multiple times.
   */
  destroy(): void {
    this.oscilloscope = null;
  }
}
