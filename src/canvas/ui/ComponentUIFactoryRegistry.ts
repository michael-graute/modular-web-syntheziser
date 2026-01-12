/**
 * ComponentUIFactoryRegistry - Registry for component-specific UI factories
 *
 * This registry provides a centralized way to retrieve the appropriate UI factory
 * for each component type, replacing the large switch-case in CanvasComponent.
 */

import { ComponentType } from '../../core/types';
import type { ComponentUIFactory } from './ComponentUIFactory';
import { OscillatorUIFactory } from './OscillatorUIFactory';
import { FilterUIFactory } from './FilterUIFactory';
import { DefaultUIFactory } from './DefaultUIFactory';

class ComponentUIFactoryRegistry {
  private factories: Map<ComponentType, ComponentUIFactory>;

  constructor() {
    this.factories = new Map();
    this.registerDefaultFactories();
  }

  /**
   * Register all default factories for built-in components
   */
  private registerDefaultFactories(): void {
    // Register specific factories
    this.register(new OscillatorUIFactory());
    this.register(new FilterUIFactory());

    // Register default factories for components without special UI
    const defaultComponents: ComponentType[] = [
      ComponentType.LFO,
      ComponentType.NOISE,
      ComponentType.VCA,
      ComponentType.ADSR_ENVELOPE,
      ComponentType.DELAY,
      ComponentType.REVERB,
      ComponentType.DISTORTION,
      ComponentType.CHORUS,
      ComponentType.MIXER,
      ComponentType.KEYBOARD_INPUT,
      ComponentType.MASTER_OUTPUT,
      ComponentType.OSCILLOSCOPE,
      ComponentType.STEP_SEQUENCER,
      ComponentType.COLLIDER,
    ];

    defaultComponents.forEach(type => {
      this.register(new DefaultUIFactory(type));
    });
  }

  /**
   * Register a UI factory for a component type
   */
  register(factory: ComponentUIFactory): void {
    this.factories.set(factory.getComponentType(), factory);
  }

  /**
   * Get the UI factory for a component type
   */
  get(type: ComponentType): ComponentUIFactory {
    const factory = this.factories.get(type);
    if (!factory) {
      // Fallback to default factory
      return new DefaultUIFactory(type);
    }
    return factory;
  }

  /**
   * Check if a specific factory is registered
   */
  has(type: ComponentType): boolean {
    return this.factories.has(type);
  }
}

// Export singleton instance
export const componentUIFactoryRegistry = new ComponentUIFactoryRegistry();
