/**
 * ChordFinderDisplay - Chord wheel renderer for the main canvas.
 *
 * Draws directly onto the main CanvasRenderingContext2D (no separate HTML
 * canvas element), so it participates in the normal render order and is
 * never obscured by — or obscures — other canvas-drawn UI such as dropdown
 * menus.
 *
 * Feature: 010-chord-finder
 */

import type { ChordFinderState } from '../../../specs/010-chord-finder/contracts/types';
import { decodeProgressionBitmask } from '../../../specs/010-chord-finder/contracts/validation';

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

const COLOR_DEFAULT = '#333333';
const COLOR_PROGRESSION = '#4ECDC4';
const COLOR_PRESSED = '#FFFFFF';
const COLOR_INACTIVE = '#222222';
const COLOR_TEXT = '#CCCCCC';
const COLOR_TEXT_DIM = '#555555';
const COLOR_CENTER_TEXT = '#AAAAAA';
const ARC_COUNT = 7;
const ARC_ANGLE = (2 * Math.PI) / ARC_COUNT;
const START_ANGLE = -Math.PI / 2; // 12 o'clock

/**
 * ChordFinder display — draws the chord circle onto the main canvas context.
 *
 * Position and size are in world (component-layout) coordinates and are
 * updated by CanvasComponent whenever the component moves.
 */
export class ChordFinderDisplay {
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;

  /** Called when user presses a chord arc */
  onChordPress: ((scaleDegree: number) => void) | null = null;
  /** Called when user releases a chord arc */
  onChordRelease: (() => void) | null = null;

  constructor(x: number, y: number, width: number, height: number) {
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  updatePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
  }

  updateSize(width: number, height: number): void {
    this.baseWidth = width;
    this.baseHeight = height;
  }

  getBaseWidth(): number { return this.baseWidth; }
  getBaseHeight(): number { return this.baseHeight; }

  // ---------------------------------------------------------------------------
  // Rendering — draws into the supplied context at world coordinates
  // ---------------------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D, state: ChordFinderState): void {
    const x = this.baseX;
    const y = this.baseY;
    const w = this.baseWidth;
    const h = this.baseHeight;

    ctx.save();

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    const cx = x + w / 2;
    const cy = y + h / 2;
    const outerR = Math.min(w, h) / 2 - 8;
    const innerR = outerR * 0.38;

    if (state.diatonicChords.length === 0) {
      this.renderEmptyState(ctx, cx, cy, outerR, innerR);
      ctx.restore();
      return;
    }

    // Decode active progression degrees
    const progressionBitmask = state.config.progression.reduce(
      (mask, d) => mask | (1 << d), 0
    );
    const progressionDegrees = new Set(decodeProgressionBitmask(progressionBitmask));

    // Draw 7 arc segments
    for (let degree = 0; degree < ARC_COUNT; degree++) {
      const chord = state.diatonicChords[degree];
      if (!chord) continue;

      const startAngle = START_ANGLE + degree * ARC_ANGLE;
      const endAngle = startAngle + ARC_ANGLE;
      const midAngle = startAngle + ARC_ANGLE / 2;

      let fillColor: string;
      let textColor: string;
      if (degree === state.pressedDegree) {
        fillColor = COLOR_PRESSED;
        textColor = '#000000';
      } else if (progressionDegrees.has(degree)) {
        fillColor = COLOR_PROGRESSION;
        textColor = '#000000';
      } else {
        fillColor = COLOR_DEFAULT;
        textColor = COLOR_TEXT;
      }

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.stroke();

      const textR = (outerR + innerR) / 2;
      const tx = cx + Math.cos(midAngle) * textR;
      const ty = cy + Math.sin(midAngle) * textR;

      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(9, outerR * 0.14)}px sans-serif`;
      ctx.fillText(chord.name, tx, ty - 6);
      ctx.font = `${Math.max(8, outerR * 0.11)}px sans-serif`;
      ctx.fillText(chord.romanNumeral, tx, ty + 7);
    }

    // Centre label
    const noteLabel = state.config.rootNote;
    const scaleLabel = state.config.scaleType === 'major' ? 'maj' : 'min';
    ctx.fillStyle = COLOR_CENTER_TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(10, innerR * 0.32)}px sans-serif`;
    ctx.fillText(noteLabel, cx, cy - 6);
    ctx.font = `${Math.max(8, innerR * 0.26)}px sans-serif`;
    ctx.fillText(scaleLabel, cx, cy + 8);

    ctx.restore();
  }

  private renderEmptyState(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    outerR: number, innerR: number
  ): void {
    for (let degree = 0; degree < ARC_COUNT; degree++) {
      const startAngle = START_ANGLE + degree * ARC_ANGLE;
      const endAngle = startAngle + ARC_ANGLE;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = COLOR_INACTIVE;
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = COLOR_TEXT_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(9, innerR * 0.28)}px sans-serif`;
    ctx.fillText('Select', cx, cy - 6);
    ctx.fillText('a key', cx, cy + 8);
  }

  // ---------------------------------------------------------------------------
  // Hit detection — called by CanvasComponent with world coordinates
  // ---------------------------------------------------------------------------

  handleWorldMouseDown(wx: number, wy: number): boolean {
    const x = wx - this.baseX;
    const y = wy - this.baseY;

    const cx = this.baseWidth / 2;
    const cy = this.baseHeight / 2;
    const outerR = Math.min(this.baseWidth, this.baseHeight) / 2 - 8;
    const innerR = outerR * 0.38;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < innerR || dist > outerR) return false;

    let angle = Math.atan2(dy, dx);
    angle -= START_ANGLE;
    if (angle < 0) angle += 2 * Math.PI;

    const degree = Math.floor(angle / ARC_ANGLE) % ARC_COUNT;
    if (this.onChordPress) this.onChordPress(degree);
    return true;
  }

  handleWorldMouseUp(): void {
    if (this.onChordRelease) this.onChordRelease();
  }

  containsWorldPoint(wx: number, wy: number): boolean {
    return (
      wx >= this.baseX && wx <= this.baseX + this.baseWidth &&
      wy >= this.baseY && wy <= this.baseY + this.baseHeight
    );
  }

  // No separate canvas element — nothing to remove from DOM.
  destroy(): void {}
}
