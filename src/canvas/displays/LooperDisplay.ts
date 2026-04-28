/**
 * LooperDisplay - Doughnut ring canvas display for Looper component (feature 015)
 *
 * Follows ColliderDisplay pattern: own HTMLCanvasElement appended to DOM
 * alongside the main canvas. Handles its own rendering and hit-testing.
 */

import {
  LooperState,
  type BarCount,
  type LooperDisplayState,
  LOOPER_STATE_COLORS,
  VALID_BAR_COUNTS,
  playHeadToAngle,
} from '../../components/utilities/LooperConstants';

// Layout constants (logical pixels)
const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 300;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = 110; // ring centre — shifted up to leave room for bar selectors + buttons below
const RING_OUTER_RADIUS = 90;
const RING_INNER_RADIUS = 80;
const RING_WIDTH = RING_OUTER_RADIUS - RING_INNER_RADIUS;

// Bar count selector — sits just below the ring
const BAR_SELECTOR_RADIUS = 10;
const BAR_SELECTOR_Y = CENTER_Y + RING_OUTER_RADIUS + 22; // ~222
const BAR_SELECTOR_POSITIONS: { barCount: BarCount; x: number; y: number }[] = [
  { barCount: 1, x: CENTER_X - 45, y: BAR_SELECTOR_Y },
  { barCount: 2, x: CENTER_X - 15, y: BAR_SELECTOR_Y },
  { barCount: 4, x: CENTER_X + 15, y: BAR_SELECTOR_Y },
  { barCount: 8, x: CENTER_X + 45, y: BAR_SELECTOR_Y },
];

// Button layout — row below bar selectors with clear spacing
const BTN_RADIUS = 16;
const BTN_Y = BAR_SELECTOR_Y + BAR_SELECTOR_RADIUS + 28; // ~260
const BTN_POSITIONS = [
  { x: 42,  label: 'R',  hint: '[1]', action: 'record'  as const },
  { x: 90,  label: '■',  hint: '[2]', action: 'stop'    as const },
  { x: 138, label: 'OD', hint: '',    action: 'overdub' as const },
  { x: 186, label: '✕',  hint: '[0]', action: 'clear'   as const },
];

type ButtonAction = 'record' | 'stop' | 'overdub' | 'clear';
export type LooperHitResult = ButtonAction | BarCount | null;

export class LooperDisplay {
  private canvas: HTMLCanvasElement;
  private baseX: number;
  private baseY: number;

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

  render(state: LooperDisplayState): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this._drawRing(ctx, state.state);

    if (state.filled || state.state === LooperState.RECORDING) {
      this._drawPlayhead(ctx, state.playHeadNormalized);
    }

    this._drawLabel(ctx, state.barCount);
    this._drawBarSelector(ctx, state.barCount);
    this._drawButtons(ctx, state.state);
  }

  private _drawRing(ctx: CanvasRenderingContext2D, state: LooperState): void {
    const color = LOOPER_STATE_COLORS[state];

    // Outer ring
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_OUTER_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // Ring band
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_OUTER_RADIUS, 0, 2 * Math.PI);
    ctx.arc(CENTER_X, CENTER_Y, RING_INNER_RADIUS, 0, 2 * Math.PI, true);
    ctx.fillStyle = color;
    ctx.fill();

    // Inner hole
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_INNER_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // Ring border
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_OUTER_RADIUS, 0, 2 * Math.PI);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    void RING_WIDTH; // used implicitly via RING_OUTER_RADIUS - RING_INNER_RADIUS
  }

  private _drawPlayhead(ctx: CanvasRenderingContext2D, normalized: number): void {
    const angle = playHeadToAngle(normalized);
    const midRadius = (RING_OUTER_RADIUS + RING_INNER_RADIUS) / 2;
    const x = CENTER_X + Math.cos(angle) * midRadius;
    const y = CENTER_Y + Math.sin(angle) * midRadius;

    // Line from ring centre to outer edge
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y);
    ctx.lineTo(
      CENTER_X + Math.cos(angle) * RING_OUTER_RADIUS,
      CENTER_Y + Math.sin(angle) * RING_OUTER_RADIUS
    );
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dot on the ring
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  private _drawLabel(ctx: CanvasRenderingContext2D, barCount: BarCount): void {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(barCount), CENTER_X, CENTER_Y - 6);

    ctx.fillStyle = '#888';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText('bars', CENTER_X, CENTER_Y + 14);
  }

  private _drawBarSelector(ctx: CanvasRenderingContext2D, activeBarCount: BarCount): void {
    for (const pos of BAR_SELECTOR_POSITIONS) {
      const isActive = pos.barCount === activeBarCount;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, BAR_SELECTOR_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = isActive ? '#4a4a4a' : '#2a2a2a';
      ctx.fill();
      ctx.strokeStyle = isActive ? '#aaa' : '#555';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isActive ? '#fff' : '#888';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(pos.barCount), pos.x, pos.y);
    }
  }

  private _drawButtons(ctx: CanvasRenderingContext2D, state: LooperState): void {
    for (const btn of BTN_POSITIONS) {
      const isActive =
        (btn.action === 'record' && state === LooperState.RECORDING) ||
        (btn.action === 'overdub' && state === LooperState.OVERDUBBING);

      ctx.beginPath();
      ctx.arc(btn.x, BTN_Y, BTN_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = isActive ? '#555' : '#2a2a2a';
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ccc';
      ctx.font = `${btn.label.length > 1 ? '9' : '11'}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x, BTN_Y);

      if (btn.hint) {
        ctx.fillStyle = '#666';
        ctx.font = '8px -apple-system, sans-serif';
        ctx.fillText(btn.hint, btn.x, BTN_Y + BTN_RADIUS + 8);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Hit testing — called from CanvasComponent with coordinates in logical px
  // relative to this canvas's top-left
  // ---------------------------------------------------------------------------

  handleMouseDown(x: number, y: number): LooperHitResult {
    // Bar count selector
    for (const pos of BAR_SELECTOR_POSITIONS) {
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= BAR_SELECTOR_RADIUS) {
        return pos.barCount;
      }
    }

    // Action buttons
    for (const btn of BTN_POSITIONS) {
      const dx = x - btn.x;
      const dy = y - BTN_Y;
      if (Math.sqrt(dx * dx + dy * dy) <= BTN_RADIUS) {
        return btn.action;
      }
    }

    return null;
  }
}

// Re-export VALID_BAR_COUNTS for CanvasComponent type guard
export { VALID_BAR_COUNTS };
