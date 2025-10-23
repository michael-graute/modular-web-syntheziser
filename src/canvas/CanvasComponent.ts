/**
 * CanvasComponent - Visual representation of synth components on canvas
 */

import { Position, ComponentType, SignalType } from '../core/types';
import { COMPONENT, COLORS } from '../utils/constants';
import type { SynthComponent } from '../components/base/SynthComponent';
import { Knob } from './controls/Knob';
import { Dropdown, DropdownOption } from './controls/Dropdown';
import { Slider } from './controls/Slider';

type Control = Knob | Dropdown | Slider;

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
   * Create UI controls based on component type
   */
  private createControls(): void {
    if (!this.synthComponent) return;

    this.controls = [];

    // Oscillator-specific controls
    if (this.type === ComponentType.OSCILLATOR) {
      const waveformParam = this.synthComponent.getParameter('waveform');
      const frequencyParam = this.synthComponent.getParameter('frequency');
      const detuneParam = this.synthComponent.getParameter('detune');

      // Calculate Y position below port labels
      // Oscillator has 2 input ports: frequency CV, detune CV
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      if (waveformParam) {
        const options: DropdownOption[] = [
          { value: 0, label: 'Sine' },
          { value: 1, label: 'Square' },
          { value: 2, label: 'Sawtooth' },
          { value: 3, label: 'Triangle' },
        ];
        const dropdown = new Dropdown(
          this.position.x + 10,
          this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + 5,
          this.width - 20,
          24,
          waveformParam,
          options,
          'Waveform'
        );
        this.controls.push(dropdown);
      }

      // Knobs for frequency and detune - positioned below dropdown
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + 5 + 24 + 10;
      const knobSize = 40;
      const spacing = (this.width - 20 - knobSize * 2) / 3;

      if (frequencyParam) {
        const knob = new Knob(
          this.position.x + 10 + spacing,
          knobY,
          knobSize,
          frequencyParam
        );
        this.controls.push(knob);
      }

      if (detuneParam) {
        const knob = new Knob(
          this.position.x + 10 + spacing * 2 + knobSize,
          knobY,
          knobSize,
          detuneParam
        );
        this.controls.push(knob);
      }
    }

    // Filter-specific controls
    if (this.type === ComponentType.FILTER) {
      const typeParam = this.synthComponent.getParameter('type');
      const cutoffParam = this.synthComponent.getParameter('cutoff');
      const resonanceParam = this.synthComponent.getParameter('resonance');

      // Calculate Y position below port labels
      // Filter has 3 input ports: audio in, cutoff CV, resonance CV
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      if (typeParam) {
        const options: DropdownOption[] = [
          { value: 0, label: 'Lowpass' },
          { value: 1, label: 'Highpass' },
          { value: 2, label: 'Bandpass' },
          { value: 3, label: 'Notch' },
        ];
        const dropdown = new Dropdown(
          this.position.x + 10,
          this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + 5,
          this.width - 20,
          24,
          typeParam,
          options,
          'Type'
        );
        this.controls.push(dropdown);
      }

      // Knobs for cutoff and resonance - positioned below dropdown
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + 5 + 24 + 10;
      const knobSize = 40;
      const spacing = (this.width - 20 - knobSize * 2) / 3;

      if (cutoffParam) {
        const knob = new Knob(
          this.position.x + 10 + spacing,
          knobY,
          knobSize,
          cutoffParam
        );
        this.controls.push(knob);
      }

      if (resonanceParam) {
        const knob = new Knob(
          this.position.x + 10 + spacing * 2 + knobSize,
          knobY,
          knobSize,
          resonanceParam
        );
        this.controls.push(knob);
      }
    }

    // ADSR Envelope-specific controls
    if (this.type === ComponentType.ADSR_ENVELOPE) {
      const attackParam = this.synthComponent.getParameter('attack');
      const decayParam = this.synthComponent.getParameter('decay');
      const sustainParam = this.synthComponent.getParameter('sustain');
      const releaseParam = this.synthComponent.getParameter('release');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Create 4 vertical sliders for ADSR
      const sliderStartY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + 10;
      const sliderHeight = 80;
      const sliderWidth = 20;
      const numSliders = 4;
      const totalSpacing = this.width - 20;
      const spacing = (totalSpacing - (numSliders * sliderWidth)) / (numSliders + 1);

      if (attackParam) {
        const slider = new Slider(
          this.position.x + 10 + spacing,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          attackParam,
          'vertical'
        );
        this.controls.push(slider);
      }

      if (decayParam) {
        const slider = new Slider(
          this.position.x + 10 + spacing * 2 + sliderWidth,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          decayParam,
          'vertical'
        );
        this.controls.push(slider);
      }

      if (sustainParam) {
        const slider = new Slider(
          this.position.x + 10 + spacing * 3 + sliderWidth * 2,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          sustainParam,
          'vertical'
        );
        this.controls.push(slider);
      }

      if (releaseParam) {
        const slider = new Slider(
          this.position.x + 10 + spacing * 4 + sliderWidth * 3,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          releaseParam,
          'vertical'
        );
        this.controls.push(slider);
      }
    }
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
    // Recreate controls at new position
    this.createControls();
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
      ctx.fillText(port.name, x + portPadding, portY + portSize / 2);
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
      ctx.fillText(port.name, x + this.width - portPadding, portY + portSize / 2);
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
    };
    return names[this.type] || 'Component';
  }

  /**
   * Handle mouse down on controls
   * Returns true if a control handled the event
   */
  handleControlMouseDown(x: number, y: number): boolean {
    for (const control of this.controls) {
      if (control instanceof Knob) {
        if (control.onMouseDown(x, y)) {
          return true;
        }
      } else if (control instanceof Dropdown) {
        if (control.onClick(x, y)) {
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
      }
    }
    return false;
  }

  /**
   * Handle mouse up on controls
   */
  handleControlMouseUp(): void {
    for (const control of this.controls) {
      if (control instanceof Knob) {
        control.onMouseUp();
      } else if (control instanceof Slider) {
        control.onMouseUp();
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
      if (control instanceof Dropdown && control.containsPoint(x, y)) {
        return true;
      }
      if (control instanceof Slider && control.containsPoint(x, y)) {
        return true;
      }
    }
    return false;
  }
}
