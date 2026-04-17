/**
 * Connection - Visual representation of cable connections
 */

import { Position, SignalType } from '../core/types';
import { CONNECTION, COLORS } from '../utils/constants';

/**
 * Visual cable connection between components
 */
export class CanvasConnection {
  id: string;
  startPos: Position;
  endPos: Position;
  signalType: SignalType;
  isHovered: boolean;

  constructor(
    id: string,
    startPos: Position,
    endPos: Position,
    signalType: SignalType
  ) {
    this.id = id;
    this.startPos = startPos;
    this.endPos = endPos;
    this.signalType = signalType;
    this.isHovered = false;
  }

  /**
   * Update connection positions
   */
  updatePositions(startPos: Position, endPos: Position): void {
    this.startPos = startPos;
    this.endPos = endPos;
  }

  /**
   * Update source position
   */
  updateSource(startPos: Position): void {
    this.startPos = startPos;
  }

  /**
   * Update target position
   */
  updateTarget(endPos: Position): void {
    this.endPos = endPos;
  }

  /**
   * Get color for signal type
   */
  private getColor(): string {
    switch (this.signalType) {
      case SignalType.AUDIO:
        return COLORS.AUDIO;
      case SignalType.CV:
        return COLORS.CV;
      case SignalType.GATE:
        return COLORS.GATE;
      default:
        return COLORS.AUDIO;
    }
  }

  /**
   * Render the connection as a bezier curve
   */
  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Calculate bezier control points
    const controlOffset = CONNECTION.BEZIER_CURVE_OFFSET;
    const cp1x = this.startPos.x + controlOffset;
    const cp1y = this.startPos.y;
    const cp2x = this.endPos.x - controlOffset;
    const cp2y = this.endPos.y;

    // Draw cable
    ctx.beginPath();
    ctx.moveTo(this.startPos.x, this.startPos.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, this.endPos.x, this.endPos.y);

    const color = this.getColor();
    ctx.strokeStyle = this.isHovered ? '#fbbf24' : color;
    ctx.lineWidth = this.isHovered
      ? CONNECTION.CABLE_WIDTH + 2
      : CONNECTION.CABLE_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw glow effect if hovered — wide semi-transparent stroke avoids shadowBlur GPU shader recompilation
    if (this.isHovered) {
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = CONNECTION.CABLE_WIDTH + 8;
      ctx.stroke();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = CONNECTION.CABLE_WIDTH + 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Check if a point is near this connection
   */
  containsPoint(x: number, y: number): boolean {
    // Sample points along the bezier curve
    const samples = 20;
    const controlOffset = CONNECTION.BEZIER_CURVE_OFFSET;
    const cp1x = this.startPos.x + controlOffset;
    const cp1y = this.startPos.y;
    const cp2x = this.endPos.x - controlOffset;
    const cp2y = this.endPos.y;

    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const curvePoint = this.bezierPoint(
        t,
        this.startPos.x,
        this.startPos.y,
        cp1x,
        cp1y,
        cp2x,
        cp2y,
        this.endPos.x,
        this.endPos.y
      );

      const dx = x - curvePoint.x;
      const dy = y - curvePoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= CONNECTION.CABLE_HIT_TOLERANCE) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate point on bezier curve at t (0 to 1)
   */
  private bezierPoint(
    t: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number
  ): Position {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const x = uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3;
    const y = uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3;

    return { x, y };
  }
}
