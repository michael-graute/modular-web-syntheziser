/**
 * ComponentRegistry - Registry for creating synth components
 */

import { ComponentType, Position } from '../core/types';
import { SynthComponent } from './base/SynthComponent';

/**
 * Factory function type for creating components
 */
type ComponentFactory = (id: string, position: Position) => SynthComponent;

/**
 * Component dimensions
 */
export interface ComponentDimensions {
  width: number;
  height: number;
}

/**
 * Component metadata
 */
interface ComponentMetadata {
  type: ComponentType;
  name: string;
  description: string;
  category: string;
  factory: ComponentFactory;
  dimensions: ComponentDimensions;
}

/**
 * Registry for managing component types and creation
 */
export class ComponentRegistry {
  private components: Map<ComponentType, ComponentMetadata>;

  constructor() {
    this.components = new Map();
  }

  /**
   * Register a component type
   */
  register(
    type: ComponentType,
    name: string,
    description: string,
    category: string,
    factory: ComponentFactory,
    dimensions: ComponentDimensions = { width: 150, height: 180 }
  ): void {
    if (this.components.has(type)) {
      console.warn(`Component type ${type} is already registered`);
      return;
    }

    this.components.set(type, {
      type,
      name,
      description,
      category,
      factory,
      dimensions,
    });

    console.log(`Registered component: ${name} (${type})`);
  }

  /**
   * Get component dimensions
   */
  getDimensions(type: ComponentType): ComponentDimensions {
    const metadata = this.components.get(type);
    if (!metadata) {
      // Return default dimensions if component not found
      return { width: 150, height: 180 };
    }
    return metadata.dimensions;
  }

  /**
   * Create a component instance
   */
  create(type: ComponentType, id: string, position: Position): SynthComponent | null {
    const metadata = this.components.get(type);
    if (!metadata) {
      console.error(`Component type ${type} not found in registry`);
      return null;
    }

    try {
      const component = metadata.factory(id, position);
      console.log(`Created component: ${component.name} (${id})`);
      return component;
    } catch (error) {
      console.error(`Failed to create component ${type}:`, error);
      return null;
    }
  }

  /**
   * Check if a component type is registered
   */
  isRegistered(type: ComponentType): boolean {
    return this.components.has(type);
  }

  /**
   * Get component metadata
   */
  getMetadata(type: ComponentType): ComponentMetadata | undefined {
    return this.components.get(type);
  }

  /**
   * Get all registered component types
   */
  getTypes(): ComponentType[] {
    return Array.from(this.components.keys());
  }

  /**
   * Get all components in a category
   */
  getByCategory(category: string): ComponentMetadata[] {
    const results: ComponentMetadata[] = [];
    this.components.forEach((metadata) => {
      if (metadata.category === category) {
        results.push(metadata);
      }
    });
    return results;
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.components.forEach((metadata) => {
      categories.add(metadata.category);
    });
    return Array.from(categories);
  }

  /**
   * Get component count
   */
  getCount(): number {
    return this.components.size;
  }

  /**
   * Get all registrations
   */
  getAllRegistrations(): ComponentMetadata[] {
    return Array.from(this.components.values());
  }

  /**
   * Clear all registered components
   */
  clear(): void {
    this.components.clear();
  }
}

// Export singleton instance
export const componentRegistry = new ComponentRegistry();
