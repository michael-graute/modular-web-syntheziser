/**
 * CanvasComponent - Visual representation of synth components on canvas
 */

import { Position, ComponentType, SignalType } from '../core/types';
import { COMPONENT, COLORS } from '../utils/constants';
import type { SynthComponent } from '../components/base/SynthComponent';
import { Knob } from './controls/Knob';
import { Dropdown, DropdownOption } from './controls/Dropdown';
import { Slider } from './controls/Slider';
import { Button } from './controls/Button';
import { OscilloscopeDisplay } from './displays/OscilloscopeDisplay';
import { SequencerDisplay } from './displays/SequencerDisplay';
import type { Oscilloscope } from '../components/analyzers/Oscilloscope';
import type { StepSequencer } from '../components/utilities/StepSequencer';
import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';

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
  private bypassButton: Button | null = null;
  private oscilloscopeDisplay: OscilloscopeDisplay | null = null;
  private sequencerDisplay: SequencerDisplay | null = null;

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
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP,
          this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
          COMPONENT.DROPDOWN_HEIGHT,
          waveformParam,
          options,
          'Waveform'
        );
        this.controls.push(dropdown);
      }

      // Knobs for frequency and detune - positioned below dropdown
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const knobSize = COMPONENT.KNOB_SIZE;
      const spacing = (this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 2) / 3;

      if (frequencyParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          frequencyParam
        );
        this.controls.push(knob);
      }

      if (detuneParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
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
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP,
          this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
          COMPONENT.DROPDOWN_HEIGHT,
          typeParam,
          options,
          'Type'
        );
        this.controls.push(dropdown);
      }

      // Knobs for cutoff and resonance - positioned below dropdown
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const knobSize = COMPONENT.KNOB_SIZE;
      const spacing = (this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 2) / 3;

      if (cutoffParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          cutoffParam
        );
        this.controls.push(knob);
      }

      if (resonanceParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
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
      const sliderStartY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const sliderHeight = COMPONENT.SLIDER_HEIGHT;
      const sliderWidth = COMPONENT.SLIDER_WIDTH;
      const numSliders = 4;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numSliders * sliderWidth)) / (numSliders + 1);

      if (attackParam) {
        const slider = new Slider(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
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
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + sliderWidth,
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
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 3 + sliderWidth * 2,
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
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 4 + sliderWidth * 3,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          releaseParam,
          'vertical'
        );
        this.controls.push(slider);
      }
    }

    // Master Output-specific controls
    if (this.type === ComponentType.MASTER_OUTPUT) {
      const volumeParam = this.synthComponent.getParameter('volume');
      const limiterParam = this.synthComponent.getParameter('limiter');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Knobs for volume and limiter
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const spacing = (this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 2) / 3;

      if (volumeParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          volumeParam
        );
        this.controls.push(knob);
      }

      if (limiterParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          limiterParam
        );
        this.controls.push(knob);
      }
    }

    // Mixer-specific controls
    if (this.type === ComponentType.MIXER) {
      const gain1Param = this.synthComponent.getParameter('gain1');
      const gain2Param = this.synthComponent.getParameter('gain2');
      const gain3Param = this.synthComponent.getParameter('gain3');
      const gain4Param = this.synthComponent.getParameter('gain4');
      const masterParam = this.synthComponent.getParameter('master');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Create 5 vertical sliders for Mixer (4 channels + master)
      const sliderStartY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const sliderHeight = COMPONENT.SLIDER_HEIGHT;
      const sliderWidth = COMPONENT.SLIDER_WIDTH;
      const numSliders = 5;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numSliders * sliderWidth)) / (numSliders + 1);

      if (gain1Param) {
        const slider = new Slider(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          gain1Param,
          'vertical'
        );
        this.controls.push(slider);
      }

      if (gain2Param) {
        const slider = new Slider(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + sliderWidth,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          gain2Param,
          'vertical'
        );
        this.controls.push(slider);
      }

      if (gain3Param) {
        const slider = new Slider(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 3 + sliderWidth * 2,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          gain3Param,
          'vertical'
        );
        this.controls.push(slider);
      }

      if (gain4Param) {
        const slider = new Slider(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 4 + sliderWidth * 3,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          gain4Param,
          'vertical'
        );
        this.controls.push(slider);
      }

      if (masterParam) {
        const slider = new Slider(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 5 + sliderWidth * 4,
          sliderStartY,
          sliderWidth,
          sliderHeight,
          masterParam,
          'vertical'
        );
        this.controls.push(slider);
      }
    }

    // Delay-specific controls
    if (this.type === ComponentType.DELAY) {
      const timeParam = this.synthComponent.getParameter('time');
      const feedbackParam = this.synthComponent.getParameter('feedback');
      const mixParam = this.synthComponent.getParameter('mix');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Knobs for delay parameters
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 3;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

      if (timeParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          timeParam
        );
        this.controls.push(knob);
      }

      if (feedbackParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          feedbackParam
        );
        this.controls.push(knob);
      }

      if (mixParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 3 + knobSize * 2,
          knobY,
          knobSize,
          mixParam
        );
        this.controls.push(knob);
      }
    }

    // Reverb-specific controls
    if (this.type === ComponentType.REVERB) {
      const roomSizeParam = this.synthComponent.getParameter('roomSize');
      const decayParam = this.synthComponent.getParameter('decay');
      const mixParam = this.synthComponent.getParameter('mix');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Knobs for reverb parameters
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 3;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

      if (roomSizeParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          roomSizeParam
        );
        this.controls.push(knob);
      }

      if (decayParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          decayParam
        );
        this.controls.push(knob);
      }

      if (mixParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 3 + knobSize * 2,
          knobY,
          knobSize,
          mixParam
        );
        this.controls.push(knob);
      }
    }

    // LFO-specific controls
    if (this.type === ComponentType.LFO) {
      const waveformParam = this.synthComponent.getParameter('waveform');
      const rateParam = this.synthComponent.getParameter('rate');
      const depthParam = this.synthComponent.getParameter('depth');

      // Calculate Y position below port labels
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
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP,
          this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
          COMPONENT.DROPDOWN_HEIGHT,
          waveformParam,
          options,
          'Waveform'
        );
        this.controls.push(dropdown);
      }

      // Knobs for rate and depth - positioned below dropdown
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const knobSize = COMPONENT.KNOB_SIZE;
      const spacing = (this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 2) / 3;

      if (rateParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          rateParam
        );
        this.controls.push(knob);
      }

      if (depthParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          depthParam
        );
        this.controls.push(knob);
      }
    }

    // Noise Generator-specific controls
    if (this.type === ComponentType.NOISE) {
      const typeParam = this.synthComponent.getParameter('type');
      const amplitudeParam = this.synthComponent.getParameter('amplitude');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      if (typeParam) {
        const options: DropdownOption[] = [
          { value: 0, label: 'White' },
          { value: 1, label: 'Pink' },
        ];
        const dropdown = new Dropdown(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP,
          this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
          COMPONENT.DROPDOWN_HEIGHT,
          typeParam,
          options,
          'Type'
        );
        this.controls.push(dropdown);
      }

      // Knob for amplitude - positioned below dropdown (centered)
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const knobSize = COMPONENT.KNOB_SIZE;
      const centerX = this.position.x + this.width / 2;

      if (amplitudeParam) {
        const knob = new Knob(
          centerX - knobSize / 2,
          knobY,
          knobSize,
          amplitudeParam
        );
        this.controls.push(knob);
      }
    }

    // Oscilloscope-specific controls
    if (this.type === ComponentType.OSCILLOSCOPE) {
      const displayModeParam = this.synthComponent.getParameter('displayMode');
      const timeScaleParam = this.synthComponent.getParameter('timeScale');
      const gainParam = this.synthComponent.getParameter('gain');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Dropdown for display mode
      if (displayModeParam) {
        const options: DropdownOption[] = [
          { value: 0, label: 'Waveform' },
          { value: 1, label: 'Spectrum' },
          { value: 2, label: 'Both' },
        ];
        const dropdown = new Dropdown(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP,
          this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
          COMPONENT.DROPDOWN_HEIGHT,
          displayModeParam,
          options,
          'Display'
        );
        this.controls.push(dropdown);
      }

      // Knobs for time scale and gain - positioned below dropdown
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const knobSize = COMPONENT.KNOB_SIZE;
      const spacing = (this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 2) / 3;

      if (timeScaleParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          timeScaleParam
        );
        this.controls.push(knob);
      }

      if (gainParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          gainParam
        );
        this.controls.push(knob);
      }

      // Create embedded oscilloscope display
      const displayY = knobY + 40 + 12 + COMPONENT.CONTROL_SPACING_VERTICAL;
      const displayWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const displayHeight = 150;

      this.oscilloscopeDisplay = new OscilloscopeDisplay(
        this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
        displayY,
        displayWidth,
        displayHeight,
        this.synthComponent as Oscilloscope
      );

      // Add canvas to DOM (will be positioned absolutely)
      const canvasElement = document.getElementById('synth-canvas');
      if (canvasElement && canvasElement.parentElement) {
        canvasElement.parentElement.appendChild(this.oscilloscopeDisplay.getCanvas());
      }
    }

    // StepSequencer-specific controls
    if (this.type === ComponentType.STEP_SEQUENCER) {
      const bpmParam = this.synthComponent.getParameter('bpm');
      const noteValueParam = this.synthComponent.getParameter('noteValue');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Knobs for BPM and note division (mode auto-detected from keyboard connection)
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 2;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

      if (bpmParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          bpmParam
        );
        this.controls.push(knob);
      }

      if (noteValueParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          noteValueParam
        );
        this.controls.push(knob);
      }

      // Create embedded sequencer display
      const displayY = knobY + 40 + 12 + COMPONENT.CONTROL_SPACING_VERTICAL;
      const displayWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const displayHeight = 160; // Increased to fully show buttons, grid, and step editor

      this.sequencerDisplay = new SequencerDisplay(
        this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
        displayY,
        displayWidth,
        displayHeight,
        this.synthComponent as StepSequencer
      );

      // Add canvas to DOM (will be positioned absolutely)
      const canvasElement = document.getElementById('synth-canvas');
      if (canvasElement && canvasElement.parentElement) {
        canvasElement.parentElement.appendChild(this.sequencerDisplay.getCanvas());
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
    // Clean up oscilloscope display before recreating controls
    if (this.oscilloscopeDisplay) {
      this.oscilloscopeDisplay.destroy();
      this.oscilloscopeDisplay = null;
    }

    // Clean up sequencer display before recreating controls
    if (this.sequencerDisplay) {
      this.sequencerDisplay.destroy();
      this.sequencerDisplay = null;
    }

    // Recreate controls at new position
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
