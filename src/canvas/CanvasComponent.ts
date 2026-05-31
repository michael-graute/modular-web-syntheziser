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
import { VuMeterDisplay } from './displays/VuMeterDisplay';
import { StepSequencerDisplay, SEQUENCER_DISPLAY_HEIGHT } from './displays/StepSequencerDisplay';
import { ColliderDisplay } from './displays/ColliderDisplay';
import { ChordFinderDisplay } from './displays/ChordFinderDisplay';
import { LooperDisplay, VALID_BAR_COUNTS } from './displays/LooperDisplay';
import type { Oscilloscope } from '../components/analyzers/Oscilloscope';
import type { StepSequencer } from '../components/utilities/StepSequencer';
import type { Collider } from '../components/utilities/Collider';
import type { ChordFinder } from '../components/utilities/ChordFinder';
import type { Looper } from '../components/utilities/Looper';
import type { Quantizer } from '../components/utilities/Quantizer';
import type { BarCount } from '../components/utilities/LooperConstants';
import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import { midiEngine } from '../midi/MidiEngine';

type Control = Knob | Dropdown | Slider | Button;

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
  private stepSequencerDisplay: StepSequencerDisplay | null = null;
  private colliderDisplay: ColliderDisplay | null = null;
  private chordFinderDisplay: ChordFinderDisplay | null = null;
  private looperDisplay: LooperDisplay | null = null;
  private vuMeterDisplay: VuMeterDisplay | null = null;
  private _looperRafId: number | null = null;

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

    // FM Oscillator-specific controls
    if (this.type === ComponentType.FM_OSCILLATOR) {
      const waveformParam = this.synthComponent.getParameter('waveform');
      const frequencyParam = this.synthComponent.getParameter('frequency');
      const detuneParam = this.synthComponent.getParameter('detune');
      const fmDepthParam = this.synthComponent.getParameter('fmDepth');

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

      // Three knobs: frequency, detune, fmDepth — evenly spaced
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const knobSize = COMPONENT.KNOB_SIZE;
      const spacing = (this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 3) / 4;

      if (frequencyParam) {
        this.controls.push(new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          frequencyParam
        ));
      }

      if (detuneParam) {
        this.controls.push(new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          detuneParam
        ));
      }

      if (fmDepthParam) {
        this.controls.push(new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 3 + knobSize * 2,
          knobY,
          knobSize,
          fmDepthParam
        ));
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

      // Knobs for cutoff, resonance, and CV amount - positioned below dropdown
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const knobSize = COMPONENT.KNOB_SIZE;
      const cvAmountParam = this.synthComponent.getParameter('cvAmount');
      const spacing = (this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 3) / 4;

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

      if (cvAmountParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 3 + knobSize * 2,
          knobY,
          knobSize,
          cvAmountParam
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

      // Pan knob row — rendered below the fader row (+10 spacing +12 label +80 slider +12 value = 114 px offset)
      const panKnobY = sliderStartY + sliderHeight + 12 + 10;
      const numPanKnobs = 4;
      const panKnobSize = COMPONENT.KNOB_SIZE;
      const panTotalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const panSpacing = (panTotalSpacing - numPanKnobs * panKnobSize) / (numPanKnobs + 1);

      const component = this.synthComponent;
      const panParams = ['pan1', 'pan2', 'pan3', 'pan4'].map(id =>
        component.getParameter(id)
      );
      panParams.forEach((param, i) => {
        if (param) {
          const knob = new Knob(
            this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + panSpacing * (i + 1) + panKnobSize * i,
            panKnobY,
            panKnobSize,
            param
          );
          this.controls.push(knob);
        }
      });
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

    // Distortion-specific controls
    if (this.type === ComponentType.DISTORTION) {
      const driveParam = this.synthComponent.getParameter('drive');
      const toneParam = this.synthComponent.getParameter('tone');
      const mixParam = this.synthComponent.getParameter('mix');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Knobs for distortion parameters
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 3;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

      if (driveParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          driveParam
        );
        this.controls.push(knob);
      }

      if (toneParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          toneParam
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

    // Chorus-specific controls
    if (this.type === ComponentType.CHORUS) {
      const rateParam = this.synthComponent.getParameter('rate');
      const depthParam = this.synthComponent.getParameter('depth');
      const mixParam = this.synthComponent.getParameter('mix');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Knobs for chorus parameters
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 3;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

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

    // Bitcrusher-specific controls
    if (this.type === ComponentType.BITCRUSHER) {
      const bitDepthParam = this.synthComponent.getParameter('bitDepth');
      const sampleRateParam = this.synthComponent.getParameter('sampleRate');
      const mixParam = this.synthComponent.getParameter('mix');

      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 3;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

      if (bitDepthParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
          knobY,
          knobSize,
          bitDepthParam
        );
        this.controls.push(knob);
      }

      if (sampleRateParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
          knobY,
          knobSize,
          sampleRateParam
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

    // Flanger-specific controls
    if (this.type === ComponentType.FLANGER) {
      const rateParam = this.synthComponent.getParameter('rate');
      const depthParam = this.synthComponent.getParameter('depth');
      const feedbackParam = this.synthComponent.getParameter('feedback');
      const mixParam = this.synthComponent.getParameter('mix');

      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 4;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

      const params = [rateParam, depthParam, feedbackParam, mixParam];
      params.forEach((param, i) => {
        if (param) {
          const knob = new Knob(
            this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * (i + 1) + knobSize * i,
            knobY,
            knobSize,
            param
          );
          this.controls.push(knob);
        }
      });
    }

    // Arpeggiator-specific controls — 4 stacked dropdowns
    if (this.type === ComponentType.ARPEGGIATOR) {
      const directionParam = this.synthComponent.getParameter('direction');
      const octavesParam = this.synthComponent.getParameter('octaves');
      const subdivisionParam = this.synthComponent.getParameter('subdivision');
      const gateLengthParam = this.synthComponent.getParameter('gateLength');

      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const dropdownX = this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL;
      const dropdownW = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const rowH = COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL + 12;
      const baseY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;

      if (directionParam) {
        this.controls.push(new Dropdown(
          dropdownX, baseY,
          dropdownW, COMPONENT.DROPDOWN_HEIGHT,
          directionParam,
          [
            { value: 0, label: 'Up' },
            { value: 1, label: 'Down' },
            { value: 2, label: 'Up-Down' },
            { value: 3, label: 'Random' },
          ],
          'Direction'
        ));
      }

      if (octavesParam) {
        this.controls.push(new Dropdown(
          dropdownX, baseY + rowH,
          dropdownW, COMPONENT.DROPDOWN_HEIGHT,
          octavesParam,
          [
            { value: 1, label: '1 octave' },
            { value: 2, label: '2 octaves' },
            { value: 3, label: '3 octaves' },
            { value: 4, label: '4 octaves' },
          ],
          'Octaves'
        ));
      }

      if (subdivisionParam) {
        this.controls.push(new Dropdown(
          dropdownX, baseY + rowH * 2,
          dropdownW, COMPONENT.DROPDOWN_HEIGHT,
          subdivisionParam,
          [
            { value: 0, label: '1/4 note' },
            { value: 1, label: '1/8 note' },
            { value: 2, label: '1/16 note' },
            { value: 3, label: '1/32 note' },
          ],
          'Rate'
        ));
      }

      if (gateLengthParam) {
        this.controls.push(new Dropdown(
          dropdownX, baseY + rowH * 3,
          dropdownW, COMPONENT.DROPDOWN_HEIGHT,
          gateLengthParam,
          [
            { value: 0, label: 'Short (25%)' },
            { value: 1, label: 'Medium (50%)' },
            { value: 2, label: 'Long (75%)' },
          ],
          'Gate Length'
        ));
      }
    }

    // Phaser-specific controls
    if (this.type === ComponentType.PHASER) {
      const rateParam = this.synthComponent.getParameter('rate');
      const depthParam = this.synthComponent.getParameter('depth');
      const feedbackParam = this.synthComponent.getParameter('feedback');
      const stagesParam = this.synthComponent.getParameter('stages');
      const mixParam = this.synthComponent.getParameter('mix');

      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 5;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

      const params = [rateParam, depthParam, feedbackParam, stagesParam, mixParam];
      params.forEach((param, i) => {
        if (param) {
          const knob = new Knob(
            this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * (i + 1) + knobSize * i,
            knobY,
            knobSize,
            param
          );
          this.controls.push(knob);
        }
      });
    }

    // Tremolo-specific controls
    if (this.type === ComponentType.TREMOLO) {
      const rateParam = this.synthComponent.getParameter('rate');
      const depthParam = this.synthComponent.getParameter('depth');
      const mixParam = this.synthComponent.getParameter('mix');

      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const numKnobs = 3;
      const totalSpacing = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const spacing = (totalSpacing - (numKnobs * knobSize)) / (numKnobs + 1);

      const params = [rateParam, depthParam, mixParam];
      params.forEach((param, i) => {
        if (param) {
          const knob = new Knob(
            this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * (i + 1) + knobSize * i,
            knobY,
            knobSize,
            param
          );
          this.controls.push(knob);
        }
      });
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

      // Create or update embedded oscilloscope display
      const displayY = knobY + 40 + 12 + COMPONENT.CONTROL_SPACING_VERTICAL;
      const displayX = this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL;
      const displayWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const displayHeight = 150;

      if (!this.oscilloscopeDisplay) {
        // Create new display
        this.oscilloscopeDisplay = new OscilloscopeDisplay(
          displayX,
          displayY,
          displayWidth,
          displayHeight,
          this.synthComponent as Oscilloscope
        );

      } else {
        // Update existing display position
        this.oscilloscopeDisplay.updatePosition(displayX, displayY);
      }
    }

    // StepSequencer-specific controls
    if (this.type === ComponentType.STEP_SEQUENCER) {
      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // BPM and Division are rendered inside the StepSequencerDisplay transport bar —
      // do not add redundant top-level knobs here.

      // Create or update embedded sequencer display (main-canvas pattern, no DOM element)
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const displayY = knobY;
      const displayX = this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL;
      const displayWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;

      if (!this.stepSequencerDisplay) {
        this.stepSequencerDisplay = new StepSequencerDisplay(
          displayX,
          displayY,
          displayWidth,
          SEQUENCER_DISPLAY_HEIGHT,
          this.synthComponent as StepSequencer
        );
      } else {
        this.stepSequencerDisplay.updatePosition(displayX, displayY, displayWidth, SEQUENCER_DISPLAY_HEIGHT);
      }
    }

    // Collider-specific controls
    if (this.type === ComponentType.COLLIDER) {
      // Get all parameters
      const scaleTypeParam = this.synthComponent.getParameter('scaleType');
      const rootNoteParam = this.synthComponent.getParameter('rootNote');
      const colliderCountParam = this.synthComponent.getParameter('colliderCount');
      const speedPresetParam = this.synthComponent.getParameter('speedPreset');
      const bpmParam = this.synthComponent.getParameter('bpm');
      const gateSizeParam = this.synthComponent.getParameter('gateSize');

      // Calculate Y position below port labels
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      // Create knobs in a grid layout (3 columns)
      const knobY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const knobSize = COMPONENT.KNOB_SIZE;
      const knobSpacing = (this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 3) / 2;

      // Row 1: Scale, Root, Count
      if (scaleTypeParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          knobY,
          knobSize,
          scaleTypeParam
        );
        this.controls.push(knob);
      }

      if (rootNoteParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + knobSize + knobSpacing,
          knobY,
          knobSize,
          rootNoteParam
        );
        this.controls.push(knob);
      }

      if (colliderCountParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + (knobSize + knobSpacing) * 2,
          knobY,
          knobSize,
          colliderCountParam
        );
        this.controls.push(knob);
      }

      // Row 2: Speed, BPM, Gate
      const knobY2 = knobY + knobSize + 20 + COMPONENT.CONTROL_SPACING_VERTICAL; // 20px for label

      if (speedPresetParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          knobY2,
          knobSize,
          speedPresetParam
        );
        this.controls.push(knob);
      }

      if (bpmParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + knobSize + knobSpacing,
          knobY2,
          knobSize,
          bpmParam
        );
        this.controls.push(knob);
      }

      if (gateSizeParam) {
        const knob = new Knob(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + (knobSize + knobSpacing) * 2,
          knobY2,
          knobSize,
          gateSizeParam
        );
        this.controls.push(knob);
      }

      // BPM Mode toggle button (Global / Local BPM)
      const bpmModeButtonY = knobY2 + knobSize + 20 + COMPONENT.CONTROL_SPACING_VERTICAL; // 20px for label
      const bpmModeButtonWidth = 90;
      const bpmModeButtonHeight = 24;
      const bpmModeButtonX = this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + knobSize + knobSpacing - (bpmModeButtonWidth - knobSize) / 2;

      const bpmModeButton = new Button(
        bpmModeButtonX,
        bpmModeButtonY,
        bpmModeButtonWidth,
        bpmModeButtonHeight,
        'Local BPM',
        () => {
          const bpmModeParam = this.synthComponent?.getParameter('bpmMode');
          if (!bpmModeParam) return;
          const current = bpmModeParam.getValue();
          this.synthComponent?.setParameterValue('bpmMode', current === 0 ? 1 : 0);
        },
        () => {
          // Active (lit) when in local mode (value === 1)
          return (this.synthComponent?.getParameter('bpmMode')?.getValue() ?? 0) === 1;
        }
      );
      this.controls.push(bpmModeButton);

      // Start/Stop button
      const buttonY = bpmModeButtonY + bpmModeButtonHeight + COMPONENT.CONTROL_SPACING_VERTICAL;
      const buttonWidth = 80;
      const buttonHeight = 30;
      const buttonX = this.position.x + (this.width - buttonWidth) / 2;

      const startStopButton = new Button(
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        'Start/Stop',
        () => {
          const collider = this.synthComponent as Collider;
          if (!collider) return;

          // Toggle simulation state
          if (collider.isSimulationRunning()) {
            collider.stopSimulation();
          } else {
            try {
              collider.startSimulation();
            } catch (error) {
              console.error('Failed to start simulation:', error);
            }
          }
        },
        () => {
          // State function: returns true when simulation is running
          const collider = this.synthComponent as Collider;
          return collider ? collider.isSimulationRunning() : false;
        }
      );

      this.controls.push(startStopButton);

      // Create or update embedded collider display
      const displayY = buttonY + buttonHeight + COMPONENT.CONTROL_SPACING_VERTICAL;
      const displayX = this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL;
      const displayWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const displayHeight = 200; // Canvas height for physics visualization

      if (!this.colliderDisplay) {
        // Create new display
        this.colliderDisplay = new ColliderDisplay(
          displayX,
          displayY,
          displayWidth,
          displayHeight,
          this.synthComponent as Collider
        );

        // Add canvas to DOM (will be positioned absolutely)
        const canvasElement2 = document.getElementById('synth-canvas');
        if (canvasElement2 && canvasElement2.parentElement) {
          canvasElement2.parentElement.appendChild(this.colliderDisplay.getCanvas());
        }
      } else {
        // Update existing display position
        this.colliderDisplay.updatePosition(displayX, displayY);
      }
    }

    // ChordFinder-specific controls (T020)
    if (this.type === ComponentType.CHORD_FINDER && this.synthComponent) {
      const chordFinder = this.synthComponent as ChordFinder;

      const numOutputPorts = this.synthComponent.outputs.size;
      const portAreaHeight = numOutputPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const rootNoteParam = this.synthComponent.getParameter('rootNote');
      const scaleTypeParam = this.synthComponent.getParameter('scaleType');

      // Root note dropdown
      const dropdownY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const noteOptions = [
        { value: 0, label: 'C' }, { value: 1, label: 'C#' }, { value: 2, label: 'D' },
        { value: 3, label: 'D#' }, { value: 4, label: 'E' }, { value: 5, label: 'F' },
        { value: 6, label: 'F#' }, { value: 7, label: 'G' }, { value: 8, label: 'G#' },
        { value: 9, label: 'A' }, { value: 10, label: 'A#' }, { value: 11, label: 'B' },
      ];
      if (rootNoteParam) {
        const dropdown = new Dropdown(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          dropdownY,
          this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
          COMPONENT.DROPDOWN_HEIGHT,
          rootNoteParam,
          noteOptions,
          'Root Note'
        );
        this.controls.push(dropdown);
      }

      // Scale type dropdown (0=Major, 1=Natural Minor)
      const scaleDropdownY = dropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const scaleOptions: DropdownOption[] = [
        { value: 0, label: 'Major' },
        { value: 1, label: 'Natural Minor' },
      ];
      if (scaleTypeParam) {
        const scaleDropdown = new Dropdown(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          scaleDropdownY,
          this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
          COMPONENT.DROPDOWN_HEIGHT,
          scaleTypeParam,
          scaleOptions,
          'Scale'
        );
        this.controls.push(scaleDropdown);
      }

      // Octave dropdown (2–6)
      const octaveParam = this.synthComponent.getParameter('octave');
      const octaveDropdownY = scaleDropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const octaveOptions: DropdownOption[] = [
        { value: 2, label: 'Oct 2' },
        { value: 3, label: 'Oct 3' },
        { value: 4, label: 'Oct 4' },
        { value: 5, label: 'Oct 5' },
        { value: 6, label: 'Oct 6' },
      ];
      if (octaveParam) {
        const octaveDropdown = new Dropdown(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          octaveDropdownY,
          this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
          COMPONENT.DROPDOWN_HEIGHT,
          octaveParam,
          octaveOptions,
          'Octave'
        );
        this.controls.push(octaveDropdown);
      }

      // Generate Progression button
      const buttonY = octaveDropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const buttonWidth = 100;
      const buttonHeight = 30;
      const buttonX = this.position.x + (this.width - buttonWidth) / 2;

      const generateButton = new Button(
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        'Generate',
        () => {
          // T041: guard — only generate if chords are loaded
          if (chordFinder.getDiatonicChords().length === 0) {
            console.warn('[ChordFinder] No key selected; cannot generate progression');
            return;
          }
          chordFinder.generateProgression();
        }
      );
      this.controls.push(generateButton);

      // Create or update chord circle display
      const displayY = buttonY + buttonHeight + COMPONENT.CONTROL_SPACING_VERTICAL;
      const displayX = this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL;
      const displayWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const displayHeight = 220;

      if (!this.chordFinderDisplay) {
        this.chordFinderDisplay = new ChordFinderDisplay(
          displayX,
          displayY,
          displayWidth,
          displayHeight
        );

        // Wire press/release callbacks (T034)
        this.chordFinderDisplay.onChordPress = (deg) => chordFinder.pressChord(deg);
        this.chordFinderDisplay.onChordRelease = () => chordFinder.releaseChord();

        // Give ChordFinder a reference to its display (T021)
        chordFinder.chordFinderDisplay = this.chordFinderDisplay;
      } else {
        this.chordFinderDisplay.updatePosition(displayX, displayY);
      }
    }

    // Looper-specific controls (T018)
    if (this.type === ComponentType.LOOPER && this.synthComponent) {
      const looper = this.synthComponent as Looper;

      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const displayX = this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL;
      const displayY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const displayWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;

      if (!this.looperDisplay) {
        this.looperDisplay = new LooperDisplay(displayX, displayY, displayWidth, 300);

        // Attach canvas to DOM (same parent as #synth-canvas)
        const synthCanvas = document.getElementById('synth-canvas');
        if (synthCanvas?.parentElement) {
          synthCanvas.parentElement.appendChild(this.looperDisplay.getCanvas());
        }

        // Enable pointer events so clicks can be forwarded
        this.looperDisplay.getCanvas().style.pointerEvents = 'auto';

        // Wire canvas click → looper actions
        this.looperDisplay.getCanvas().addEventListener('click', (e: MouseEvent) => {
          const rect = this.looperDisplay!.getCanvas().getBoundingClientRect();
          const zoom = parseFloat(this.looperDisplay!.getCanvas().style.transform.replace('scale(', '') || '1');
          const canvasZoom = isNaN(zoom) ? 1 : zoom;
          const lx = (e.clientX - rect.left) / canvasZoom;
          const ly = (e.clientY - rect.top) / canvasZoom;
          const result = this.looperDisplay!.handleMouseDown(lx, ly);
          if (result === null) return;
          if (result === 'record') {
            looper.pressRecord();
          } else if (result === 'stop') {
            looper.pressStop();
          } else if (result === 'overdub') {
            looper.pressOverdub();
          } else if (result === 'clear') {
            looper.pressClear();
          } else if (VALID_BAR_COUNTS.includes(result as BarCount)) {
            looper.setBarCount(result as BarCount);
          }
        });
      } else {
        this.looperDisplay.updatePosition(displayX, displayY);
      }

      // Schedule render loop for the looper display
      if (!this._looperRafId) {
        const renderLoop = () => {
          if (this.looperDisplay) {
            this.looperDisplay.render(looper.getDisplayState());
            this._looperRafId = requestAnimationFrame(renderLoop);
          }
        };
        this._looperRafId = requestAnimationFrame(renderLoop);
      }
    }

    // ParametricEQ controls: 3 rows of knobs (Low: 2, Mid: 3, High: 2)
    if (this.type === ComponentType.PARAMETRIC_EQ && this.synthComponent) {
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const knobSize = COMPONENT.KNOB_SIZE;
      const usableWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const rowY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const rowStride = knobSize + 12 + 12 + COMPONENT.CONTROL_SPACING_VERTICAL; // knob + label + value + gap

      // Low row: 2 knobs (lowGain, lowFreq) — evenly spaced across width
      const lowSpacing = (usableWidth - knobSize * 2) / 3;
      const lowParams: Array<string> = ['lowGain', 'lowFreq'];
      lowParams.forEach((id, i) => {
        const param = this.synthComponent!.getParameter(id);
        if (param) {
          this.controls.push(new Knob(
            this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + lowSpacing * (i + 1) + knobSize * i,
            rowY,
            knobSize,
            param
          ));
        }
      });

      // Mid row: 3 knobs (midGain, midFreq, midQ)
      const midSpacing = (usableWidth - knobSize * 3) / 4;
      const midParams: Array<string> = ['midGain', 'midFreq', 'midQ'];
      const midRowY = rowY + rowStride;
      midParams.forEach((id, i) => {
        const param = this.synthComponent!.getParameter(id);
        if (param) {
          this.controls.push(new Knob(
            this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + midSpacing * (i + 1) + knobSize * i,
            midRowY,
            knobSize,
            param
          ));
        }
      });

      // High row: 2 knobs (highGain, highFreq)
      const highRowY = midRowY + rowStride;
      const highParams: Array<string> = ['highGain', 'highFreq'];
      highParams.forEach((id, i) => {
        const param = this.synthComponent!.getParameter(id);
        if (param) {
          this.controls.push(new Knob(
            this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + lowSpacing * (i + 1) + knobSize * i,
            highRowY,
            knobSize,
            param
          ));
        }
      });
    }

    // Quantizer controls: root note dropdown, scale type dropdown
    if (this.type === ComponentType.QUANTIZER && this.synthComponent) {
      const numInputPorts = this.synthComponent.inputs.size;
      const numOutputPorts = this.synthComponent.outputs.size;
      const maxPorts = Math.max(numInputPorts, numOutputPorts);
      const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const rootNoteParam = this.synthComponent.getParameter('rootNote');
      const scaleTypeParam = this.synthComponent.getParameter('scaleType');

      const dropdownY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const dropdownWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;

      const noteOptions: DropdownOption[] = [
        { value: 0, label: 'C' }, { value: 1, label: 'C#' }, { value: 2, label: 'D' },
        { value: 3, label: 'D#' }, { value: 4, label: 'E' }, { value: 5, label: 'F' },
        { value: 6, label: 'F#' }, { value: 7, label: 'G' }, { value: 8, label: 'G#' },
        { value: 9, label: 'A' }, { value: 10, label: 'A#' }, { value: 11, label: 'B' },
      ];
      if (rootNoteParam) {
        this.controls.push(new Dropdown(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          dropdownY,
          dropdownWidth,
          COMPONENT.DROPDOWN_HEIGHT,
          rootNoteParam,
          noteOptions,
          'Root'
        ));
      }

      const scaleDropdownY = dropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
      const scaleOptions: DropdownOption[] = [
        { value: 0, label: 'Major' },
        { value: 1, label: 'Natural Minor' },
        { value: 2, label: 'Harmonic Minor' },
        { value: 3, label: 'Lydian' },
        { value: 4, label: 'Mixolydian' },
        { value: 5, label: 'Pentatonic Maj' },
        { value: 6, label: 'Pentatonic Min' },
        { value: 7, label: 'Chromatic' },
      ];
      if (scaleTypeParam) {
        this.controls.push(new Dropdown(
          this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
          scaleDropdownY,
          dropdownWidth,
          COMPONENT.DROPDOWN_HEIGHT,
          scaleTypeParam,
          scaleOptions,
          'Scale'
        ));
      }
    }

    // VU Meter — no knobs or dropdowns; display area only
    if (this.type === ComponentType.VU_METER && this.synthComponent) {
      const numInputPorts = this.synthComponent.inputs.size;
      const portAreaHeight = numInputPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

      const displayX = this.position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL;
      const displayY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
      const displayWidth = this.width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
      const displayHeight = 200;

      if (!this.vuMeterDisplay) {
        this.vuMeterDisplay = new VuMeterDisplay(
          displayX,
          displayY,
          displayWidth,
          displayHeight,
          this.synthComponent as import('../components/analyzers/VuMeter').VuMeter
        );
      } else {
        this.vuMeterDisplay.updatePosition(displayX, displayY);
      }
    }
  }

  /**
   * Check if a point is inside this component (including open dropdown menu overflow).
   */
  containsPoint(x: number, y: number): boolean {
    if (
      x >= this.position.x &&
      x <= this.position.x + this.width &&
      y >= this.position.y &&
      y <= this.position.y + this.height
    ) {
      return true;
    }
    // Step sequencer display dropdowns (note picker, gate dropdowns) expand below
    // the component bounding box — include their open menu areas.
    if (this.stepSequencerDisplay?.hasOpenMenuAt(x, y)) {
      return true;
    }
    return false;
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

      // Render controls if available, otherwise fallback to text parameters.
      // StepSequencer has no top-level controls but owns its own display — skip the text fallback.
      if (this.controls.length > 0) {
        this.renderControls(ctx);
      } else if (!this.stepSequencerDisplay) {
        this.renderParameters(ctx);
      }

      // Render Quantizer note label
      if (this.type === ComponentType.QUANTIZER && this.synthComponent) {
        const quantizer = this.synthComponent as Quantizer;
        const label = quantizer.getNoteLabel();
        const labelX = this.position.x + this.width / 2;
        // Position below the two dropdowns
        const numInputPorts = this.synthComponent.inputs.size;
        const numOutputPorts = this.synthComponent.outputs.size;
        const maxPorts = Math.max(numInputPorts, numOutputPorts);
        const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;
        const labelY = this.position.y + COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP
          + (COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL) * 2 + 18;
        ctx.save();
        ctx.font = 'bold 20px -apple-system, sans-serif';
        ctx.fillStyle = '#4a9eff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelX, labelY);
        ctx.restore();
      }

      // Render chord circle directly onto the main canvas (after controls,
      // before dropdown menus which are drawn in a separate pass on top)
      if (this.chordFinderDisplay && this.synthComponent) {
        const chordFinder = this.synthComponent as import('../components/utilities/ChordFinder').ChordFinder;
        this.chordFinderDisplay.render(ctx, chordFinder.getState());
      }

      // Render oscilloscope display onto the main canvas (after controls,
      // before dropdown menus which are drawn in a separate pass on top)
      if (this.oscilloscopeDisplay) {
        this.oscilloscopeDisplay.render(ctx);
      }

      // Render VU Meter display onto the main canvas
      if (this.vuMeterDisplay) {
        this.vuMeterDisplay.render(ctx);
      }

      // Render step sequencer display onto the main canvas
      if (this.stepSequencerDisplay) {
        this.stepSequencerDisplay.render(ctx);
      }
    }

    // Restore context state
    ctx.restore();
  }

  /**
   * Render UI controls
   */
  private renderControls(ctx: CanvasRenderingContext2D): void {
    const mappings = midiEngine.getMappings();
    const mappedParams = new Set(mappings.map((m) => m.componentId === this.synthComponent?.id ? m.parameterName : null).filter(Boolean));

    this.controls.forEach(control => {
      control.render(ctx);

      // Draw a small MIDI-assigned dot on controls that have an active mapping
      if ((control instanceof Knob || control instanceof Slider) && mappedParams.size > 0) {
        const param = control.getParameter();
        const paramName = this.bareParamId(param.id);
        if (mappedParams.has(paramName)) {
          const bounds = control.getBounds();
          const dotR = 3;
          const dotX = bounds.x + bounds.width - dotR - 1;
          const dotY = bounds.y + dotR + 1;
          ctx.save();
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(66, 165, 245, 0.9)';
          ctx.fill();
          ctx.restore();
        }
      }
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
    if (this.stepSequencerDisplay) {
      this.stepSequencerDisplay.renderDropdownMenus(ctx);
    }
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
    if (this.stepSequencerDisplay) {
      this.stepSequencerDisplay = null;
    }
    if (this.colliderDisplay) {
      this.colliderDisplay.destroy();
      this.colliderDisplay = null;
    }
    if (this.chordFinderDisplay) {
      this.chordFinderDisplay.destroy();
      this.chordFinderDisplay = null;
    }
    if (this._looperRafId !== null) {
      cancelAnimationFrame(this._looperRafId);
      this._looperRafId = null;
    }
    if (this.looperDisplay) {
      this.looperDisplay.destroy();
      this.looperDisplay = null;
    }
    if (this.vuMeterDisplay) {
      this.vuMeterDisplay.destroy();
      this.vuMeterDisplay = null;
    }
  }

  /**
   * Update viewport transform for embedded displays (like oscilloscope)
   */
  updateViewportTransform(zoom: number, panX: number, panY: number): void {
    // oscilloscopeDisplay and stepSequencerDisplay draw on the main canvas — no separate transform needed.
    if (this.colliderDisplay) {
      this.colliderDisplay.updateViewportTransform(zoom, panX, panY);
    }
    if (this.looperDisplay) {
      this.looperDisplay.updateViewportTransform(zoom, panX, panY);
    }
    // chordFinderDisplay draws on the main canvas — no separate transform needed.
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
      [ComponentType.BITCRUSHER]: 'Bitcrusher',
      [ComponentType.FLANGER]: 'Flanger',
      [ComponentType.PHASER]: 'Phaser',
      [ComponentType.TREMOLO]: 'Tremolo',
      [ComponentType.MIXER]: 'Mixer',
      [ComponentType.KEYBOARD_INPUT]: 'Keyboard',
      [ComponentType.MASTER_OUTPUT]: 'Master Out',
      [ComponentType.OSCILLOSCOPE]: 'Scope',
      [ComponentType.STEP_SEQUENCER]: 'Sequencer',
      [ComponentType.COLLIDER]: 'Collider',
      [ComponentType.CHORD_FINDER]: 'Chord Finder',
      [ComponentType.LOOPER]: 'Looper',
      [ComponentType.FM_OSCILLATOR]: 'FM Oscillator',
      [ComponentType.QUANTIZER]: 'Quantizer',
      [ComponentType.PARAMETRIC_EQ]: 'Parametric EQ',
      [ComponentType.VU_METER]: 'VU Meter',
      [ComponentType.RING_MODULATOR]: 'Ring Mod',
      [ComponentType.ARPEGGIATOR]: 'Arpeggiator',
    };
    return names[this.type] || 'Component';
  }

  /**
   * Handle mouse down on controls
   * Returns true if a control handled the event
   */
  handleControlMouseDown(x: number, y: number): boolean {
    // MIDI Learn interception: if learn mode is active, the first knob/slider click
    // registers a mapping instead of adjusting the parameter normally.
    if (midiEngine.isLearnActive() && this.synthComponent) {
      for (const control of this.controls) {
        const isHit =
          (control instanceof Knob && control.containsPoint(x, y)) ||
          (control instanceof Slider && control.containsPoint(x, y));
        if (isHit) {
          const param = control.getParameter();
          const paramName = this.bareParamId(param.id);
          midiEngine.startLearn(this.synthComponent.id, paramName);
          return true;
        }
      }
    }

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
        const param = control.getParameter();
        const valueBefore = param.getValue();
        if (control.onMouseDown(x, y)) {
          // Only propagate to audio engine when the value actually changed
          if (this.synthComponent && param.getValue() !== valueBefore) {
            this.synthComponent.setParameterValue(param.id, param.getValue());
            eventBus.emit(EventType.PARAMETER_CHANGED, {
              componentId: this.synthComponent.id,
              componentType: this.synthComponent.type,
              parameterId: this.bareParamId(param.id),
              value: param.getValue(),
            });
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

    // Forward to chord circle hit detection (T033)
    if (this.chordFinderDisplay?.handleWorldMouseDown(x, y)) {
      return true;
    }

    // Forward to step sequencer display
    if (this.stepSequencerDisplay?.onMouseDown(x, y)) {
      return true;
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
            eventBus.emit(EventType.PARAMETER_CHANGED, {
              componentId: this.synthComponent.id,
              componentType: this.synthComponent.type,
              parameterId: this.bareParamId(param.id),
              value: param.getValue(),
            });
          }
          return true;
        }
      } else if (control instanceof Slider) {
        if (control.onMouseMove(x, y)) {
          // Update audio parameter as slider is dragged
          if (this.synthComponent) {
            const param = control.getParameter();
            this.synthComponent.setParameterValue(param.id, param.getValue());
            eventBus.emit(EventType.PARAMETER_CHANGED, {
              componentId: this.synthComponent.id,
              componentType: this.synthComponent.type,
              parameterId: this.bareParamId(param.id),
              value: param.getValue(),
            });
          }
          return true;
        }
      } else if (control instanceof Button) {
        control.handleMouseMove(x, y);
      }
    }
    if (this.stepSequencerDisplay?.onMouseMove(x, y)) {
      return true;
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

    // Release chord on mouseup
    this.chordFinderDisplay?.handleWorldMouseUp();

    // Forward to step sequencer display
    this.stepSequencerDisplay?.onMouseUp();
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

  // Parameter IDs are stored as 'componentId:paramName' — strip the prefix for events.
  bareParamId(prefixedId: string): string {
    const colon = prefixedId.indexOf(':');
    return colon >= 0 ? prefixedId.slice(colon + 1) : prefixedId;
  }
}
