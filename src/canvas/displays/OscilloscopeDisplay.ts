/**
 * OscilloscopeDisplay - Canvas-based visualization for Oscilloscope component
 */

import type { Oscilloscope } from '../../components/analyzers/Oscilloscope';
import { visualUpdateScheduler } from '../../visualization/scheduler';
import type { SubscriptionHandle } from '../../visualization/types';

/**
 * Display renderer for oscilloscope visualization
 */
export class OscilloscopeDisplay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private oscilloscope: Oscilloscope;
  private subscription: SubscriptionHandle | null;
  private isFrozen: boolean;
  private baseWidth: number;
  private baseHeight: number;
  private baseX: number;
  private baseY: number;

  // Performance optimization: throttle to 30fps
  private lastRenderTime: number = 0;
  private targetFPS: number = 30;
  private frameInterval: number = 1000 / this.targetFPS;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    oscilloscope: Oscilloscope
  ) {
    this.oscilloscope = oscilloscope;
    this.isFrozen = false;
    this.subscription = null;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.border = '1px solid #444';
    this.canvas.style.backgroundColor = '#1a1a1a';
    this.canvas.style.pointerEvents = 'none'; // Don't interfere with canvas interactions
    this.canvas.style.transformOrigin = '0 0'; // Transform from top-left corner

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context for oscilloscope display');
    }
    this.ctx = context;

    // Subscribe to centralized scheduler
    this.subscription = visualUpdateScheduler.onFrame((_deltaMs) => {
      const now = performance.now();

      // Throttle to 30fps (component-level)
      if (now - this.lastRenderTime >= this.frameInterval) {
        // Skip rendering if not visible
        if (!this.isVisible()) return;

        if (!this.isFrozen) {
          this.render();
        }
        this.lastRenderTime = now;
      }
    }, 'OscilloscopeDisplay');
  }

  /**
   * Check if canvas is visible in viewport (Performance optimization)
   */
  private isVisible(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }


  /**
   * Main render method
   */
  private render(): void {
    const displayModeParam = this.oscilloscope.getParameter('displayMode');
    const displayMode = displayModeParam ? Math.round(displayModeParam.getValue()) : 0;

    // Clear canvas
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    this.drawGrid();

    // Render based on display mode
    switch (displayMode) {
      case 0: // Waveform only
        this.renderWaveform(0, this.canvas.height);
        break;
      case 1: // Spectrum only
        this.renderSpectrum(0, this.canvas.height);
        break;
      case 2: // Both (split view)
        const halfHeight = this.canvas.height / 2;
        this.renderWaveform(0, halfHeight);
        this.renderSpectrum(halfHeight, halfHeight);
        break;
    }
  }

  /**
   * Draw grid lines
   */
  private drawGrid(): void {
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 1;

    // Vertical grid lines
    const gridSpacingX = this.canvas.width / 8;
    for (let i = 1; i < 8; i++) {
      const x = i * gridSpacingX;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    // Horizontal grid lines
    const gridSpacingY = this.canvas.height / 6;
    for (let i = 1; i < 6; i++) {
      const y = i * gridSpacingY;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // Center line (brighter)
    this.ctx.strokeStyle = '#555555';
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.canvas.height / 2);
    this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
    this.ctx.stroke();
  }

  /**
   * Render waveform (time-domain)
   */
  private renderWaveform(offsetY: number, height: number): void {
    const data = this.oscilloscope.getWaveformData();
    if (!data || data.length === 0) return;

    const gainParam = this.oscilloscope.getParameter('gain');
    const gain = gainParam ? gainParam.getValue() : 1.0;

    this.ctx.strokeStyle = '#00ff00';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    const sliceWidth = this.canvas.width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      if (sample === undefined) continue;

      const v = sample * gain;
      const y = offsetY + (height / 2) * (1 - v);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.ctx.stroke();
  }

  /**
   * Render spectrum (frequency-domain)
   */
  private renderSpectrum(offsetY: number, height: number): void {
    const data = this.oscilloscope.getSpectrumData();
    if (!data || data.length === 0) return;

    const barWidth = this.canvas.width / data.length;

    this.ctx.fillStyle = '#00aaff';

    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      if (sample === undefined) continue;

      const barHeight = (sample / 255) * height;
      const x = i * barWidth;
      const y = offsetY + height - barHeight;

      this.ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  }

  /**
   * Update position when component moves
   */
  updatePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
  }

  /**
   * Update viewport transform (zoom and pan)
   */
  updateViewportTransform(zoom: number, panX: number, panY: number): void {
    // Apply CSS transform to match the main canvas viewport
    const screenX = this.baseX * zoom + panX;
    const screenY = this.baseY * zoom + panY;

    this.canvas.style.left = `${screenX}px`;
    this.canvas.style.top = `${screenY}px`;
    this.canvas.style.transform = `scale(${zoom})`;
    this.canvas.width = this.baseWidth;
    this.canvas.height = this.baseHeight;
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Toggle freeze display
   */
  setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
  }

  /**
   * Destroy display and clean up
   */
  destroy(): void {
    // Unsubscribe from centralized scheduler
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
