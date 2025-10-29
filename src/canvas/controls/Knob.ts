/**
 * Canvas-based Knob Control
 * Rotary knob for controlling numeric parameters
 */

import { Parameter } from '../../components/base/Parameter';
import { IVisualizableControl } from '../../visualization/types';

export class Knob implements IVisualizableControl {
  private x: number;
  private y: number;
  private size: number;
  private parameter: Parameter;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartValue: number = 0;

  // Visualization properties
  private controlId: string;
  private visible: boolean = true;
  private visualValue: number | null = null; // For modulation visualization

  constructor(x: number, y: number, size: number, parameter: Parameter) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.parameter = parameter;
    this.controlId = `knob-${parameter.id}-${Date.now()}`;
  }

  // IVisualizableControl implementation
  getControlId(): string {
    return this.controlId;
  }

  setVisualValue(normalizedValue: number): void {
    // Store the modulation-driven value
    this.visualValue = Math.max(0, Math.min(1, normalizedValue));
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;
  }

  /**
   * Render the knob
   */
  render(ctx: CanvasRenderingContext2D): void {
    // Skip rendering if not visible (off-screen optimization)
    if (!this.visible) {
      return;
    }

    const centerX = this.x + this.size / 2;
    const centerY = this.y + this.size / 2;
    const radius = this.size / 2 - 4;

    // Draw outer circle (track)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a2a';
    ctx.fill();
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Calculate rotation angle based on parameter value
    // Use visualValue if available (from modulation), otherwise use parameter value
    // Range: -135 degrees to +135 degrees (270 degree rotation)
    const normalized = this.visualValue !== null ? this.visualValue : this.parameter.getNormalizedValue();
    const angle = -135 + (normalized * 270);
    const radians = (angle * Math.PI) / 180;


    // Draw indicator line
    const indicatorLength = radius * 0.7;
    const indicatorX = centerX + Math.sin(radians) * indicatorLength;
    const indicatorY = centerY - Math.cos(radians) * indicatorLength;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(indicatorX, indicatorY);
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#4a9eff';
    ctx.fill();

    // Draw parameter name above
    ctx.fillStyle = '#808080';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.parameter.name, centerX, this.y - 2);

    // Draw value below
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.parameter.getDisplayValue(), centerX, this.y + this.size + 2);
  }

  /**
   * Check if point is inside knob
   */
  containsPoint(x: number, y: number): boolean {
    const centerX = this.x + this.size / 2;
    const centerY = this.y + this.size / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.size / 2;
  }

  /**
   * Handle mouse down
   */
  onMouseDown(x: number, y: number): boolean {
    if (this.containsPoint(x, y)) {
      this.isDragging = true;
      this.dragStartY = y;
      this.dragStartValue = this.parameter.getValue();
      console.log(`✓ Knob "${this.parameter.name}" mouse down`);
      return true;
    }
    return false;
  }

  /**
   * Handle mouse move
   */
  onMouseMove(_x: number, y: number): boolean {
    if (!this.isDragging) return false;

    // Calculate drag delta (inverted - drag up increases value)
    const deltaY = this.dragStartY - y;
    const sensitivity = 0.5; // Adjust for feel
    const range = this.parameter.max - this.parameter.min;
    const deltaValue = (deltaY * sensitivity * range) / 100;

    // Update parameter value
    const newValue = this.dragStartValue + deltaValue;
    this.parameter.setValue(newValue);

    return true;
  }

  /**
   * Handle mouse up
   */
  onMouseUp(): void {
    this.isDragging = false;
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
      x: this.x,
      y: this.y - 12, // Include label
      width: this.size,
      height: this.size + 24, // Include label and value
    };
  }
}
