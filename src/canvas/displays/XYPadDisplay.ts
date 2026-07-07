/**
 * XYPadDisplay - 2D drag surface canvas display for X-Y Pad component (feature 035)
 *
 * Follows LooperDisplay pattern: own HTMLCanvasElement appended to DOM
 * alongside the main canvas. Handles its own rendering and hit-testing,
 * plus continuous drag tracking (mousedown/mousemove/mouseup) which
 * LooperDisplay does not need since its buttons are click-only.
 */

import { XYPadState, type XYPadDisplayState } from '../../components/utilities/XYPadConstants';

// Layout constants (logical pixels)
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 260;
const PAD_MARGIN = 10;
const PAD_SIZE = CANVAS_WIDTH - PAD_MARGIN * 2; // 180 — square drag surface
const PAD_LEFT = PAD_MARGIN;
const PAD_TOP = PAD_MARGIN;

const HANDLE_RADIUS = 8;

// Button row below the pad
const BTN_RADIUS = 16;
const BTN_Y = PAD_TOP + PAD_SIZE + 28;
const BTN_POSITIONS = [
  { x: CANVAS_WIDTH / 2 - 48, label: 'R', hint: '', action: 'record' as const },
  { x: CANVAS_WIDTH / 2, label: '■', hint: '', action: 'stop' as const },
  { x: CANVAS_WIDTH / 2 + 48, label: '▶', hint: '', action: 'play' as const },
];

type ButtonAction = 'record' | 'stop' | 'play';
export type XYPadHitResult = ButtonAction | null;

const STATE_COLORS: Record<XYPadState, string> = {
  [XYPadState.IDLE]: '#4a4a4a',
  [XYPadState.RECORDING]: '#e05252',
  [XYPadState.PLAYING]: '#4caf50',
};

export class XYPadDisplay {
  private canvas: HTMLCanvasElement;
  private baseX: number;
  private baseY: number;
  private isDragging: boolean = false;

  constructor(x: number, y: number, _w: number, _h: number) {
    this.baseX = x;
    this.baseY = y;

    const dpr = window.devicePixelRatio || 1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH * dpr;
    this.canvas.height = CANVAS_HEIGHT * dpr;
    this.canvas.style.width = `${CANVAS_WIDTH}px`;
    this.canvas.style.height = `${CANVAS_HEIGHT}px`;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.transformOrigin = '0 0';
    this.canvas.style.zIndex = '100';

    const ctx = this.canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  updatePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
  }

  updateViewportTransform(zoom: number, panX: number, panY: number): void {
    const screenX = this.baseX * zoom + panX;
    const screenY = this.baseY * zoom + panY;
    this.canvas.style.left = `${screenX}px`;
    this.canvas.style.top = `${screenY}px`;
    this.canvas.style.transform = `scale(${zoom})`;
  }

  destroy(): void {
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  render(state: XYPadDisplayState): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this._drawPad(ctx, state.state);
    this._drawHandle(ctx, state.x, state.y);
    this._drawButtons(ctx, state.state, state.hasRecording);
  }

  private _drawPad(ctx: CanvasRenderingContext2D, state: XYPadState): void {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(PAD_LEFT, PAD_TOP, PAD_SIZE, PAD_SIZE);

    ctx.strokeStyle = STATE_COLORS[state];
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD_LEFT, PAD_TOP, PAD_SIZE, PAD_SIZE);

    // Crosshair guides at center
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT + PAD_SIZE / 2, PAD_TOP);
    ctx.lineTo(PAD_LEFT + PAD_SIZE / 2, PAD_TOP + PAD_SIZE);
    ctx.moveTo(PAD_LEFT, PAD_TOP + PAD_SIZE / 2);
    ctx.lineTo(PAD_LEFT + PAD_SIZE, PAD_TOP + PAD_SIZE / 2);
    ctx.stroke();
  }

  private _drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // y is normalised bottom-to-top (0 = bottom, 1 = top) per spec Assumptions;
    // canvas y grows downward, so invert for drawing.
    const px = PAD_LEFT + x * PAD_SIZE;
    const py = PAD_TOP + (1 - y) * PAD_SIZE;

    ctx.beginPath();
    ctx.arc(px, py, HANDLE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = '#4a9eff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private _drawButtons(ctx: CanvasRenderingContext2D, state: XYPadState, hasRecording: boolean): void {
    for (const btn of BTN_POSITIONS) {
      const isActive =
        (btn.action === 'record' && state === XYPadState.RECORDING) ||
        (btn.action === 'play' && state === XYPadState.PLAYING);
      const isDisabled = btn.action === 'play' && !hasRecording;

      ctx.beginPath();
      ctx.arc(btn.x, BTN_Y, BTN_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = isActive ? '#555' : '#2a2a2a';
      ctx.fill();
      ctx.strokeStyle = isDisabled ? '#3a3a3a' : '#666';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isDisabled ? '#555' : '#ccc';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x, BTN_Y);
    }
  }

  // ---------------------------------------------------------------------------
  // Hit testing / drag — called from CanvasComponent with coordinates in
  // logical px relative to this canvas's top-left
  // ---------------------------------------------------------------------------

  /** Returns a button action if a button was hit, or starts a pad drag. */
  handleMouseDown(x: number, y: number): XYPadHitResult {
    for (const btn of BTN_POSITIONS) {
      const dx = x - btn.x;
      const dy = y - BTN_Y;
      if (Math.sqrt(dx * dx + dy * dy) <= BTN_RADIUS) {
        return btn.action;
      }
    }

    if (x >= PAD_LEFT && x <= PAD_LEFT + PAD_SIZE && y >= PAD_TOP && y <= PAD_TOP + PAD_SIZE) {
      this.isDragging = true;
    }

    return null;
  }

  /**
   * Convert local canvas coordinates to normalised [0,1] pad position if
   * currently dragging. Returns null when not dragging or outside the pad
   * (caller should still clamp — XYPad.setAxisPosition clamps regardless).
   */
  handleMouseMove(x: number, y: number): { x: number; y: number } | null {
    if (!this.isDragging) return null;

    const nx = (x - PAD_LEFT) / PAD_SIZE;
    const ny = 1 - (y - PAD_TOP) / PAD_SIZE; // invert: canvas y down → normalised y up
    return { x: nx, y: ny };
  }

  handleMouseUp(): void {
    this.isDragging = false;
  }

  isPadDragging(): boolean {
    return this.isDragging;
  }
}
