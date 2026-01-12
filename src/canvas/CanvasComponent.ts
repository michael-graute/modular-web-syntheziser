/**
 * CanvasComponent - Visual representation of synth components on canvas
 */

import { Position, ComponentType, SignalType } from '../core/types';
import { COMPONENT, COLORS } from '../utils/constants';
import type { SynthComponent } from '../components/base/SynthComponent';
import { Knob } from './controls/Knob';
import { Dropdown } from './controls/Dropdown';
import { Slider } from './controls/Slider';
import { Button } from './controls/Button';
import { OscilloscopeDisplay } from './displays/OscilloscopeDisplay';
import { SequencerDisplay } from './displays/SequencerDisplay';
import { ColliderDisplay } from './displays/ColliderDisplay';
import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import { componentUIFactoryRegistry } from './ui/ComponentUIFactoryRegistry';
import type { Control } from './ui/ComponentUIFactory';

// Re-export Control type for backward compatibility
export type { Control };

/**
 * Base class for visual component representation
 */
export class CanvasComponent {
  id: string;
  type: ComponentType;
  position: Position;
  width: number;
  height: number;
  isSelected: boolean;
  synthComponent: SynthComponent | null;
  private controls: Control[] = [];
  private bypassButton: Button | null = null;
  private oscilloscopeDisplay: OscilloscopeDisplay | null = null;
  private sequencerDisplay: SequencerDisplay | null = null;
  private colliderDisplay: ColliderDisplay | null = null;

  constructor(
    id: string,
    type: ComponentType,
    position: Position,
    width: number = COMPONENT.MIN_WIDTH,
    height: number = COMPONENT.MIN_HEIGHT
  ) {
    this.id = id;
    this.type = type;
    this.position = position;
    this.width = width;
    this.height = height;
    this.isSelected = false;
    this.synthComponent = null;
  }

  /**
   * Link this visual component to its audio component
   */
  setSynthComponent(component: SynthComponent): void {
    this.synthComponent = component;
    this.createControls();
  }

  /**
   * Get the linked synth component
   */
  getSynthComponent(): SynthComponent | null {
    return this.synthComponent;
  }

  /**
   * Get all UI controls (knobs, sliders, buttons)
   */
  getControls(): (Knob | Slider | Button | Dropdown)[] {
    const allControls: (Knob | Slider | Button | Dropdown)[] = [...this.controls];
    if (this.bypassButton) {
      allControls.push(this.bypassButton);
    }
    return allControls;
  }

  /**
   * Create UI controls based on component type
   *
   * Uses the factory pattern to delegate control creation to component-specific factories.
   * This replaces the previous 900+ line switch-case with a clean, maintainable approach.
   */
  private createControls(): void {
    if (!this.synthComponent) return;

    // Get the appropriate UI factory for this component type
    const factory = componentUIFactoryRegistry.get(this.type);

    // Use factory to create controls
    this.controls = factory.createControls(
      this.synthComponent,
      this.position,
      this.width,
      this.height
    );

    // TODO: Handle special components with embedded displays (Oscilloscope, Sequencer, Collider)
    // TODO: Handle bypass button creation for bypassable components
    // These will be addressed in a follow-up refactoring
  }

  /**
   * Check if a point is inside this component
   */
  containsPoint(x: number, y: number): boolean {
    return (
      x >= this.position.x &&
      x <= this.position.x + this.width &&
      y >= this.position.y &&
      y <= this.position.y + this.height
    );
  }

  /**
   * Move component to new position
   */
  moveTo(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
    this.updateControlPositions();
  }

  /**
   * Move component by delta
   */
  moveBy(dx: number, dy: number): void {
    this.position.x += dx;
    this.position.y += dy;
    this.updateControlPositions();
  }

  /**
   * Update control positions after component moves
   */
  private updateControlPositions(): void {
    // Update display positions instead of destroying and recreating them
    // This preserves the canvas and rendering state

    // NOTE: We used to destroy and recreate displays here, but that caused the canvas
    // to be replaced while the simulation was running, making rendering invisible.
    // Now we just update positions on existing displays.

    // Recreate controls at new position (this updates knobs, buttons, etc.)
    this.createControls();

    // Emit event so ModulationVisualizer can re-register the new controls
    eventBus.emit(EventType.CONTROLS_RECREATED, {
      componentId: this.id,
      component: this,
    });

    // Note: The viewport transform will be reapplied by Canvas.updateComponentViewportTransforms()
    // which is called during drag operations and after snapping to grid
  }

  /**
   * Get component bounds
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Render the component on canvas
   */
  render(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this.position;

    // Save context state
    ctx.save();

    // Apply dimming if bypassed
    if (this.synthComponent?.isBypassed) {
      ctx.globalAlpha = COMPONENT.BYPASSED_OPACITY;
    }

    // Draw component background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x, y, this.width, this.height);

    // Draw border
    ctx.strokeStyle = this.isSelected ? '#4a9eff' : '#505050';
    ctx.lineWidth = this.isSelected ? 3 : 2;
    ctx.strokeRect(x, y, this.width, this.height);

    // Draw header
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x, y, this.width, COMPONENT.HEADER_HEIGHT);

    // Draw header border
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + COMPONENT.HEADER_HEIGHT);
    ctx.lineTo(x + this.width, y + COMPONENT.HEADER_HEIGHT);
    ctx.stroke();

    // Draw component name
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.getDisplayName(),
      x + 8,
      y + COMPONENT.HEADER_HEIGHT / 2
    );

    // Draw bypass button in header (for bypassable components)
    if (this.synthComponent?.isBypassable()) {
      this.renderBypassButton(ctx);
    }

    // Draw ports if synth component is linked
    if (this.synthComponent) {
      this.renderPorts(ctx);

      // Render controls if available, otherwise fallback to text parameters
      if (this.controls.length > 0) {
        this.renderControls(ctx);
      } else {
        this.renderParameters(ctx);
      }
    }

    // Restore context state
    ctx.restore();
  }

  /**
   * Render UI controls
   */
  private renderControls(ctx: CanvasRenderingContext2D): void {
    this.controls.forEach(control => {
      control.render(ctx);
    });
  }

  /**
   * Render dropdown menus on top (separate pass for z-index)
   */
  renderDropdownMenus(ctx: CanvasRenderingContext2D): void {
    this.controls.forEach(control => {
      if (control instanceof Dropdown) {
        control.renderMenu(ctx);
      }
    });
  }

  /**
   * Render bypass button in component header
   */
  private renderBypassButton(ctx: CanvasRenderingContext2D): void {
    if (!this.synthComponent) return;

    const buttonSize = COMPONENT.BYPASS_BUTTON_SIZE;
    const buttonX = this.position.x + this.width - buttonSize - COMPONENT.BYPASS_BUTTON_MARGIN;
    const buttonY = this.position.y + (COMPONENT.HEADER_HEIGHT - buttonSize) / 2;

    // Create button if it doesn't exist
    if (!this.bypassButton) {
      this.bypassButton = new Button(
        buttonX,
        buttonY,
        buttonSize,
        buttonSize,
        '⚡',
        () => this.toggleBypass(),
        () => !this.synthComponent!.isBypassed // Active when NOT bypassed
      );
    }

    // Update button position (in case component moved)
    this.bypassButton.updatePosition(buttonX, buttonY);

    // Render button
    this.bypassButton.render(ctx);
  }

  /**
   * Toggle bypass state
   */
  private toggleBypass(): void {
    if (!this.synthComponent) return;

    const newState = !this.synthComponent.isBypassed;
    this.synthComponent.setBypass(newState);

    console.log(`${this.synthComponent.type} bypass: ${newState}`);
  }

  /**
   * Render input and output ports
   */
  private renderPorts(ctx: CanvasRenderingContext2D): void {
    if (!this.synthComponent) return;

    const { x, y } = this.position;
    const portSize = COMPONENT.PORT_SIZE;
    const portPadding = COMPONENT.PORT_PADDING;

    // Render input ports on the left
    const inputs = Array.from(this.synthComponent.inputs.values());
    inputs.forEach((port, index) => {
      const portY = y + COMPONENT.HEADER_HEIGHT + portPadding + (index * (portSize + portPadding));
      const portX = x; // Port sits on the left edge

      this.drawPort(ctx, portX, portY, portSize, port.type, true);

      // Draw port label
      ctx.fillStyle = '#b0b0b0';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(port.name, x + portPadding, portY);
    });

    // Render output ports on the right
    const outputs = Array.from(this.synthComponent.outputs.values());
    outputs.forEach((port, index) => {
      const portY = y + COMPONENT.HEADER_HEIGHT + portPadding + (index * (portSize + portPadding));
      const portX = x + this.width; // Port sits on the right edge

      this.drawPort(ctx, portX, portY, portSize, port.type, false);

      // Draw port label
      ctx.fillStyle = '#b0b0b0';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(port.name, x + this.width - portPadding, portY);
    });
  }

  /**
   * Draw a single port
   */
  private drawPort(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: SignalType,
    _isInput: boolean
  ): void {
    // Get color based on signal type
    const color = this.getPortColor(type);

    // Draw port circle
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Get port color based on signal type
   */
  private getPortColor(type: SignalType): string {
    switch (type) {
      case SignalType.AUDIO:
        return COLORS.AUDIO;
      case SignalType.CV:
        return COLORS.CV;
      case SignalType.GATE:
        return COLORS.GATE;
      default:
        return '#ffffff';
    }
  }

  /**
   * Cleanup when component is removed
   */
  cleanup(): void {
    if (this.oscilloscopeDisplay) {
      this.oscilloscopeDisplay.destroy();
      this.oscilloscopeDisplay = null;
    }
    if (this.sequencerDisplay) {
      this.sequencerDisplay.destroy();
      this.sequencerDisplay = null;
    }
    if (this.colliderDisplay) {
      this.colliderDisplay.destroy();
      this.colliderDisplay = null;
    }
  }

  /**
   * Update viewport transform for embedded displays (like oscilloscope)
   */
  updateViewportTransform(zoom: number, panX: number, panY: number): void {
    if (this.oscilloscopeDisplay) {
      this.oscilloscopeDisplay.updateViewportTransform(zoom, panX, panY);
    }
    if (this.sequencerDisplay) {
      this.sequencerDisplay.updateViewportTransform(zoom, panX, panY);
    }
    if (this.colliderDisplay) {
      this.colliderDisplay.updateViewportTransform(zoom, panX, panY);
    }
  }

  /**
   * Render parameter values
   */
  private renderParameters(ctx: CanvasRenderingContext2D): void {
    if (!this.synthComponent) return;

    const { x, y } = this.position;
    const params = Array.from(this.synthComponent.parameters.values());

    // Calculate position for parameters (below ports)
    const startY = y + COMPONENT.HEADER_HEIGHT + 60;

    params.forEach((param, index) => {
      const paramY = startY + (index * 20);

      // Draw parameter name and value
      ctx.fillStyle = '#808080';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(param.name, x + 8, paramY);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(param.getDisplayValue(), x + this.width - 8, paramY);
    });
  }

  /**
   * Get port position for connections
   */
  getPortPosition(portId: string, isInput: boolean): Position | null {
    if (!this.synthComponent) return null;

    const { x, y } = this.position;
    const portSize = COMPONENT.PORT_SIZE;
    const portPadding = COMPONENT.PORT_PADDING;

    const ports = isInput
      ? Array.from(this.synthComponent.inputs.values())
      : Array.from(this.synthComponent.outputs.values());

    const index = ports.findIndex((p) => p.id === portId);
    if (index === -1) return null;

    const portY = y + COMPONENT.HEADER_HEIGHT + portPadding + (index * (portSize + portPadding));
    const portX = isInput ? x : x + this.width;

    return { x: portX, y: portY };
  }

  /**
   * Find port at position
   */
  getPortAt(px: number, py: number): { portId: string; isInput: boolean } | null {
    if (!this.synthComponent) return null;

    const portSize = COMPONENT.PORT_SIZE;
    const hitRadius = portSize;

    // Check input ports
    const inputs = Array.from(this.synthComponent.inputs.values());
    for (let i = 0; i < inputs.length; i++) {
      const pos = this.getPortPosition(inputs[i]!.id, true);
      if (pos) {
        const dx = px - pos.x;
        const dy = py - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
          return { portId: inputs[i]!.id, isInput: true };
        }
      }
    }

    // Check output ports
    const outputs = Array.from(this.synthComponent.outputs.values());
    for (let i = 0; i < outputs.length; i++) {
      const pos = this.getPortPosition(outputs[i]!.id, false);
      if (pos) {
        const dx = px - pos.x;
        const dy = py - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
          return { portId: outputs[i]!.id, isInput: false };
        }
      }
    }

    return null;
  }

  /**
   * Get display name for this component type
   */
  private getDisplayName(): string {
    const names: Record<ComponentType, string> = {
      [ComponentType.OSCILLATOR]: 'Oscillator',
      [ComponentType.LFO]: 'LFO',
      [ComponentType.NOISE]: 'Noise',
      [ComponentType.FILTER]: 'Filter',
      [ComponentType.VCA]: 'VCA',
      [ComponentType.ADSR_ENVELOPE]: 'ADSR',
      [ComponentType.FILTER_ENVELOPE]: 'Filter Env',
      [ComponentType.DELAY]: 'Delay',
      [ComponentType.REVERB]: 'Reverb',
      [ComponentType.DISTORTION]: 'Distortion',
      [ComponentType.CHORUS]: 'Chorus',
      [ComponentType.MIXER]: 'Mixer',
      [ComponentType.KEYBOARD_INPUT]: 'Keyboard',
      [ComponentType.MASTER_OUTPUT]: 'Master Out',
      [ComponentType.OSCILLOSCOPE]: 'Scope',
      [ComponentType.STEP_SEQUENCER]: 'Sequencer',
      [ComponentType.COLLIDER]: 'Collider',
    };
    return names[this.type] || 'Component';
  }

  /**
   * Handle mouse down on controls
   * Returns true if a control handled the event
   */
  handleControlMouseDown(x: number, y: number): boolean {
    // Check bypass button first
    if (this.bypassButton?.handleMouseDown(x, y)) {
      return true;
    }

    for (const control of this.controls) {
      if (control instanceof Knob) {
        if (control.onMouseDown(x, y)) {
          return true;
        }
      } else if (control instanceof Dropdown) {
        if (control.onMouseDown(x, y)) {
          // Update audio parameter when dropdown changes
          if (this.synthComponent) {
            const param = control.getParameter();
            this.synthComponent.setParameterValue(param.id, param.getValue());
          }
          return true;
        }
      } else if (control instanceof Slider) {
        if (control.onMouseDown(x, y)) {
          return true;
        }
      } else if (control instanceof Button) {
        if (control.handleMouseDown(x, y)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Handle mouse move on controls
   * Returns true if a control handled the event
   */
  handleControlMouseMove(x: number, y: number): boolean {
    for (const control of this.controls) {
      if (control instanceof Knob) {
        if (control.onMouseMove(x, y)) {
          // Update audio parameter as knob is dragged
          if (this.synthComponent) {
            const param = control.getParameter();
            this.synthComponent.setParameterValue(param.id, param.getValue());
          }
          return true;
        }
      } else if (control instanceof Slider) {
        if (control.onMouseMove(x, y)) {
          // Update audio parameter as slider is dragged
          if (this.synthComponent) {
            const param = control.getParameter();
            this.synthComponent.setParameterValue(param.id, param.getValue());
          }
          return true;
        }
      } else if (control instanceof Button) {
        control.handleMouseMove(x, y);
      }
    }
    return false;
  }

  /**
   * Handle mouse up on controls
   */
  handleControlMouseUp(x: number, y: number): void {
    // Check bypass button first
    if (this.bypassButton?.handleMouseUp(x, y)) {
      return;
    }

    for (const control of this.controls) {
      if (control instanceof Knob) {
        control.onMouseUp();
      } else if (control instanceof Slider) {
        control.onMouseUp();
      } else if (control instanceof Button) {
        control.handleMouseUp(x, y);
      }
    }
  }

  /**
   * Check if a point is over any control
   */
  isPointOverControl(x: number, y: number): boolean {
    for (const control of this.controls) {
      if (control instanceof Knob && control.containsPoint(x, y)) {
        return true;
      }
      if (control instanceof Dropdown) {
        if (control.containsPoint(x, y) || control.containsMenuPoint(x, y)) {
          return true;
        }
      }
      if (control instanceof Slider && control.containsPoint(x, y)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all dropdown controls
   */
  getDropdownControls(): Dropdown[] {
    return this.controls.filter(control => control instanceof Dropdown) as Dropdown[];
  }
}
