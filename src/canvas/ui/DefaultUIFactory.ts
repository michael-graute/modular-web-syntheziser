/**
 * DefaultUIFactory - Default UI factory for components without special controls
 *
 * This factory is used for components that don't need custom UI controls,
 * such as VCA, NoiseGenerator, Delay, Reverb, etc.
 */

import { BaseComponentUIFactory, type Control } from './ComponentUIFactory';
import { ComponentType, type Position } from '../../core/types';
import type { SynthComponent } from '../../components/base/SynthComponent';
import { Knob } from '../controls/Knob';
import { COMPONENT } from '../../utils/constants';

export class DefaultUIFactory extends BaseComponentUIFactory {
  constructor(private componentType: ComponentType) {
    super();
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  createControls(
    synthComponent: SynthComponent,
    position: Position,
    width: number,
    _height: number
  ): Control[] {
    const controls: Control[] = [];
    const controlStartY = this.getControlStartY(synthComponent, position);

    // Create knobs for all parameters
    const parameters = Array.from(synthComponent.parameters.values());
    const knobSize = COMPONENT.KNOB_SIZE;
    const numKnobs = parameters.length;

    if (numKnobs === 0) {
      return controls;
    }

    // Calculate spacing for knobs
    const totalWidth = width - COMPONENT.CONTROL_MARGIN_HORIZONTAL * 2;
    const spacing = numKnobs > 1 ? (totalWidth - knobSize * numKnobs) / (numKnobs + 1) : (totalWidth - knobSize) / 2;

    parameters.forEach((param, index) => {
      const knob = new Knob(
        position.x + COMPONENT.CONTROL_MARGIN_HORIZONTAL + spacing + (spacing + knobSize) * index,
        controlStartY,
        knobSize,
        param
      );
      controls.push(knob);
    });

    return controls;
  }

  override calculateHeight(synthComponent: SynthComponent, _width: number): number {
    const baseHeight = super.calculateHeight(synthComponent, _width);
    const parameters = synthComponent.parameters;

    if (parameters.size === 0) {
      return baseHeight;
    }

    // Add space for knobs
    return baseHeight + COMPONENT.KNOB_SIZE;
  }
}
