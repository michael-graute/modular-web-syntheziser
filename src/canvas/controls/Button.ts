/**
 * Canvas-based Button Control
 * Clickable button for triggering actions
 */

import { Parameter } from '../../components/base/Parameter';
import { IVisualizableControl } from '../../visualization/types';

export class Button implements IVisualizableControl {
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private label: string;
  private onClick: () => void;
  private isPressed: boolean = false;
  private isHovered: boolean = false;
  private state?: () => boolean; // Optional state function for toggle buttons

  // Visualization properties
  private controlId: string;
  private visible: boolean = true;
  private visualValue: number | null = null;
  private parameter: Parameter | null = null; // Optional parameter for modulation

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    state?: () => boolean,
    parameter?: Parameter
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.label = label;
    this.onClick = onClick;
    this.state = state;
    this.parameter = parameter || null;
    this.controlId = `button-${label}-${Date.now()}`;
  }

  // IVisualizableControl implementation
  getControlId(): string {
    return this.controlId;
  }

  setVisualValue(normalizedValue: number): void {
    this.visualValue = Math.max(0, Math.min(1, normalizedValue));
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;
  }

  getParameter(): Parameter {
    if (!this.parameter) {
      throw new Error('Button does not have an associated parameter');
    }
    return this.parameter;
  }

  /**
   * Render the button
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) {
      return;
    }

    const isActive = this.state ? this.state() : false;

    // Draw button background
    ctx.fillStyle = isActive ? '#4a9eff' : (this.isPressed ? '#3a3a3a' : (this.isHovered ? '#353535' : '#2a2a2a'));
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Draw button border
    ctx.strokeStyle = isActive ? '#6ab9ff' : (this.isHovered ? '#606060' : '#505050');
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Draw label
    ctx.fillStyle = isActive ? '#000000' : '#ffffff';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
  }

  /**
   * Update button position
   */
  updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Handle mouse down event
   */
  handleMouseDown(x: number, y: number): boolean {
    if (this.containsPoint(x, y)) {
      this.isPressed = true;
      return true;
    }
    return false;
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(x: number, y: number): boolean {
    if (this.isPressed && this.containsPoint(x, y)) {
      this.isPressed = false;
      this.onClick();
      return true;
    }
    this.isPressed = false;
    return false;
  }

  /**
   * Handle click event (simpler alternative to mousedown/mouseup sequence)
   */
  handleClick(x: number, y: number): boolean {
    if (this.containsPoint(x, y)) {
      this.onClick();
      return true;
    }
    return false;
  }

  /**
   * Handle mouse move event for hover state
   */
  handleMouseMove(x: number, y: number): void {
    this.isHovered = this.containsPoint(x, y);
  }

  /**
   * Check if point is inside button
   */
  private containsPoint(x: number, y: number): boolean {
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    );
  }
}
