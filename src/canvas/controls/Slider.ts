/**
 * Canvas-based Slider Control
 * Linear slider for controlling numeric parameters
 */

import { Parameter } from '../../components/base/Parameter';

export class Slider {
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private parameter: Parameter;
  private isDragging: boolean = false;
  private orientation: 'horizontal' | 'vertical';

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    parameter: Parameter,
    orientation: 'horizontal' | 'vertical' = 'vertical'
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.parameter = parameter;
    this.orientation = orientation;
  }

  /**
   * Render the slider
   */
  render(ctx: CanvasRenderingContext2D): void {
    const normalized = this.parameter.getNormalizedValue();

    if (this.orientation === 'vertical') {
      this.renderVertical(ctx, normalized);
    } else {
      this.renderHorizontal(ctx, normalized);
    }
  }

  /**
   * Render vertical slider
   */
  private renderVertical(ctx: CanvasRenderingContext2D, normalized: number): void {
    const trackWidth = 4;
    const trackX = this.x + (this.width - trackWidth) / 2;

    // Draw track background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(trackX, this.y, trackWidth, this.height);
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = 1;
    ctx.strokeRect(trackX, this.y, trackWidth, this.height);

    // Draw filled portion (from bottom)
    const fillHeight = this.height * normalized;
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(trackX, this.y + (this.height - fillHeight), trackWidth, fillHeight);

    // Draw handle
    const handleY = this.y + (this.height - fillHeight);
    const handleWidth = this.width;
    const handleHeight = 8;

    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(this.x, handleY - handleHeight / 2, handleWidth, handleHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, handleY - handleHeight / 2, handleWidth, handleHeight);

    // Draw parameter name to the left (rotated)
    ctx.save();
    ctx.translate(this.x - 8, this.y + this.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#808080';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.parameter.name, 0, 0);
    ctx.restore();

    // Draw value below
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.parameter.getDisplayValue(), this.x + this.width / 2, this.y + this.height + 2);
  }

  /**
   * Render horizontal slider
   */
  private renderHorizontal(ctx: CanvasRenderingContext2D, normalized: number): void {
    const trackHeight = 4;
    const trackY = this.y + (this.height - trackHeight) / 2;

    // Draw track background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(this.x, trackY, this.width, trackHeight);
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, trackY, this.width, trackHeight);

    // Draw filled portion (from left)
    const fillWidth = this.width * normalized;
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(this.x, trackY, fillWidth, trackHeight);

    // Draw handle
    const handleX = this.x + fillWidth;
    const handleWidth = 8;
    const handleHeight = this.height;

    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(handleX - handleWidth / 2, this.y, handleWidth, handleHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(handleX - handleWidth / 2, this.y, handleWidth, handleHeight);

    // Draw parameter name above
    ctx.fillStyle = '#808080';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.parameter.name, this.x, this.y - 2);

    // Draw value to the right
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.parameter.getDisplayValue(), this.x + this.width + 4, this.y - 2);
  }

  /**
   * Check if point is inside slider
   */
  containsPoint(x: number, y: number): boolean {
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    );
  }

  /**
   * Handle mouse down
   */
  onMouseDown(x: number, y: number): boolean {
    if (this.containsPoint(x, y)) {
      this.isDragging = true;
      this.updateValueFromPosition(x, y);
      return true;
    }
    return false;
  }

  /**
   * Handle mouse move
   */
  onMouseMove(x: number, y: number): boolean {
    if (!this.isDragging) return false;
    this.updateValueFromPosition(x, y);
    return true;
  }

  /**
   * Handle mouse up
   */
  onMouseUp(): void {
    this.isDragging = false;
  }

  /**
   * Update parameter value from mouse position
   */
  private updateValueFromPosition(x: number, y: number): void {
    let normalized: number;

    if (this.orientation === 'vertical') {
      // Vertical: bottom = 0, top = max
      const clampedY = Math.max(this.y, Math.min(y, this.y + this.height));
      normalized = 1 - (clampedY - this.y) / this.height;
    } else {
      // Horizontal: left = min, right = max
      const clampedX = Math.max(this.x, Math.min(x, this.x + this.width));
      normalized = (clampedX - this.x) / this.width;
    }

    const value = this.parameter.min + normalized * (this.parameter.max - this.parameter.min);
    this.parameter.setValue(value);
  }

  /**
   * Get parameter
   */
  getParameter(): Parameter {
    return this.parameter;
  }

  /**
   * Get bounds
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x - 20, // Include rotated label
      y: this.y,
      width: this.width + 20,
      height: this.height + 12, // Include value text
    };
  }
}
