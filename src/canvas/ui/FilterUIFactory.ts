/**
 * FilterUIFactory - Creates UI controls for Filter components
 */

import { BaseComponentUIFactory, type Control } from './ComponentUIFactory';
import { ComponentType, type Position } from '../../core/types';
import type { SynthComponent } from '../../components/base/SynthComponent';
import { Knob } from '../controls/Knob';
import { Dropdown, type DropdownOption } from '../controls/Dropdown';
import { COMPONENT } from '../../utils/constants';

export class FilterUIFactory extends BaseComponentUIFactory {
  getComponentType(): ComponentType {
    return ComponentType.FILTER;
  }

  createControls(
    synthComponent: SynthComponent,
    position: Position,
    width: number,
    _height: number
  ): Control[] {
    const controls: Control[] = [];

    const typeParam = synthComponent.getParameter('type');
    const cutoffParam = synthComponent.getParameter('cutoff');
    const resonanceParam = synthComponent.getParameter('resonance');

    const controlStartY = this.getControlStartY(synthComponent, position);

    // Filter type dropdown
    if (typeParam) {
      const options: DropdownOption[] = [
        { value: 0, label: 'Lowpass' },
        { value: 1, label: 'Highpass' },
        { value: 2, label: 'Bandpass' },
        { value: 3, label: 'Notch' },
      ];

      const dropdown = new Dropdown(
        position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL,
        controlStartY,
        width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2,
        COMPONENT.DROPDOWN_HEIGHT,
        typeParam,
        options,
        'Type'
      );
      controls.push(dropdown);
    }

    // Knobs for cutoff and resonance (below dropdown)
    const knobY = controlStartY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
    const knobSize = COMPONENT.KNOB_SIZE;
    const spacing = (width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2 - knobSize * 2) / 3;

    if (cutoffParam) {
      const knob = new Knob(
        position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing,
        knobY,
        knobSize,
        cutoffParam
      );
      controls.push(knob);
    }

    if (resonanceParam) {
      const knob = new Knob(
        position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing * 2 + knobSize,
        knobY,
        knobSize,
        resonanceParam
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
