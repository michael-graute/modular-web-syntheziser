/**
 * Canvas-based Dropdown Control
 * For selecting discrete values (like waveform types)
 */

import { Parameter } from '../../components/base/Parameter';

export interface DropdownOption {
  value: number;
  label: string;
}

export class Dropdown {
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private parameter: Parameter;
  private options: DropdownOption[];
  private label: string;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    parameter: Parameter,
    options: DropdownOption[],
    label: string
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.parameter = parameter;
    this.options = options;
    this.label = label;
  }

  /**
   * Render the dropdown
   */
  render(ctx: CanvasRenderingContext2D): void {
    // Draw label above
    ctx.fillStyle = '#808080';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.label, this.x, this.y - 2);

    // Draw dropdown box
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Get current selected option
    const currentValue = Math.round(this.parameter.getValue());
    const currentOption = this.options.find(opt => opt.value === currentValue);
    const displayText = currentOption ? currentOption.label : '???';

    // Draw selected value
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, this.x + 6, this.y + this.height / 2);

    // Draw dropdown arrow
    const arrowX = this.x + this.width - 12;
    const arrowY = this.y + this.height / 2;
    ctx.fillStyle = '#808080';
    ctx.beginPath();
    ctx.moveTo(arrowX - 3, arrowY - 2);
    ctx.lineTo(arrowX + 3, arrowY - 2);
    ctx.lineTo(arrowX, arrowY + 2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Check if point is inside dropdown
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
   * Handle click - cycle through options
   */
  onClick(x: number, y: number): boolean {
    if (this.containsPoint(x, y)) {
      // Cycle to next option
      const currentValue = Math.round(this.parameter.getValue());
      const currentIndex = this.options.findIndex(opt => opt.value === currentValue);
      const nextIndex = (currentIndex + 1) % this.options.length;
      this.parameter.setValue(this.options[nextIndex]!.value);
      return true;
    }
    return false;
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
      width: this.width,
      height: this.height + 12,
    };
  }
}
