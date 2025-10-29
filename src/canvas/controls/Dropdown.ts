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
  private isOpen: boolean = false;

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
   * Render the dropdown menu (should be called in a separate pass to ensure it's on top)
   */
  renderMenu(ctx: CanvasRenderingContext2D): void {
    if (!this.isOpen) return;

    const currentValue = Math.round(this.parameter.getValue());
    this.renderMenuInternal(ctx, currentValue);
  }

  /**
   * Render the dropdown menu overlay
   */
  private renderMenuInternal(ctx: CanvasRenderingContext2D, currentValue: number): void {
    const menuY = this.y + this.height;
    const itemHeight = 24;
    const menuHeight = this.options.length * itemHeight;

    // Draw menu background with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(this.x, menuY, this.width, menuHeight);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw menu border
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, menuY, this.width, menuHeight);

    // Draw menu items
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    this.options.forEach((option, index) => {
      const itemY = menuY + index * itemHeight;
      const isSelected = option.value === currentValue;

      // Highlight selected item
      if (isSelected) {
        ctx.fillStyle = '#404040';
        ctx.fillRect(this.x, itemY, this.width, itemHeight);
      }

      // Draw option text
      ctx.fillStyle = isSelected ? '#ffffff' : '#cccccc';
      ctx.fillText(option.label, this.x + 8, itemY + itemHeight / 2);
    });
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
   * Handle mouse down - toggle dropdown or select option
   */
  onMouseDown(x: number, y: number): boolean {
    // Check if clicking on a menu item when open
    if (this.isOpen) {
      const menuY = this.y + this.height;
      const itemHeight = 24;

      for (let i = 0; i < this.options.length; i++) {
        const itemY = menuY + i * itemHeight;
        if (
          x >= this.x &&
          x <= this.x + this.width &&
          y >= itemY &&
          y <= itemY + itemHeight
        ) {
          // Select this option
          this.parameter.setValue(this.options[i]!.value);
          this.isOpen = false;
          return true;
        }
      }

      // Check if clicking on the dropdown button while open (close it)
      if (this.containsPoint(x, y)) {
        this.isOpen = false;
        return true;
      }

      // Clicked outside - close menu
      this.isOpen = false;
      return false;
    }

    // Check if clicking on the dropdown button when closed (open it)
    if (this.containsPoint(x, y)) {
      this.isOpen = true;
      return true;
    }

    return false;
  }

  /**
   * Handle click - for backwards compatibility
   */
  onClick(x: number, y: number): boolean {
    return this.onMouseDown(x, y);
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

  /**
   * Close the dropdown menu (e.g., when clicking outside)
   */
  close(): void {
    this.isOpen = false;
  }

  /**
   * Check if dropdown is currently open
   */
  isDropdownOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Check if point is inside the dropdown menu
   */
  containsMenuPoint(x: number, y: number): boolean {
    if (!this.isOpen) return false;

    const menuY = this.y + this.height;
    const itemHeight = 24;
    const menuHeight = this.options.length * itemHeight;

    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= menuY &&
      y <= menuY + menuHeight
    );
  }
}
