/**
 * OscillatorUIFactory - Creates UI controls for Oscillator components
 */

import { BaseComponentUIFactory, type Control } from './ComponentUIFactory';
import { ComponentType, type Position } from '../../core/types';
import type { SynthComponent } from '../../components/base/SynthComponent';
import { Knob } from '../controls/Knob';
import { Dropdown, type DropdownOption } from '../controls/Dropdown';
import { COMPONENT } from '../../utils/constants';

export class OscillatorUIFactory extends BaseComponentUIFactory {
  getComponentType(): ComponentType {
    return ComponentType.OSCILLATOR;
  }

  createControls(
    synthComponent: SynthComponent,
    position: Position,
    width: number,
    _height: number
  ): Control[] {
    const controls: Control[] = [];

    const waveformParam = synthComponent.getParameter('waveform');
    const frequencyParam = synthComponent.getParameter('frequency');
    const detuneParam = synthComponent.getParameter('detune');

    const controlStartY = this.getControlStartY(synthComponent, position);

    // Waveform dropdown
    if (waveformParam) {
      const options: DropdownOption[] = [
        { value: 0, label: 'Sine' },
        { value: 1, label: 'Square' },
        { value: 2, label: 'Sawtooth' },
        { value: 3, label: 'Triangle' },
      ];

      const dropdown = new Dropdown(
        position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
        controlStartY,
        width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
        COMPONENT.DROPDOWN_HEIGHT,
        waveformParam,
        options,
        'Waveform'
      );
      controls.push(dropdown);
    }

    // Knobs for frequency and detune (below dropdown)
    const knobY = controlStartY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
    const knobSize = COMPONENT.KNOB_SIZE;
    const spacing = (width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 2) / 3;

    if (frequencyParam) {
      const knob = new Knob(
        position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
        knobY,
        knobSize,
        frequencyParam
      );
      controls.push(knob);
    }

    if (detuneParam) {
      const knob = new Knob(
        position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
        knobY,
        knobSize,
        detuneParam
      );
      controls.push(knob);
    }

    return controls;
  }

  override calculateHeight(synthComponent: SynthComponent, width: number): number {
    const baseHeight = super.calculateHeight(synthComponent, width);
    // Add space for dropdown + knobs
    const controlsHeight = COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL + COMPONENT.KNOB_SIZE;
    return baseHeight + controlsHeight;
  }
}
