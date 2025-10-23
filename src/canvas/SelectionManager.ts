/**
 * SelectionManager - Handles component selection on canvas
 */

import { CanvasComponent } from './CanvasComponent';

/**
 * Manages selection of components on the canvas
 */
export class SelectionManager {
  private selectedComponents: Set<string>;

  constructor() {
    this.selectedComponents = new Set();
  }

  /**
   * Select a component
   */
  select(componentId: string): void {
    this.selectedComponents.add(componentId);
  }

  /**
   * Deselect a component
   */
  deselect(componentId: string): void {
    this.selectedComponents.delete(componentId);
  }

  /**
   * Toggle component selection
   */
  toggle(componentId: string): void {
    if (this.selectedComponents.has(componentId)) {
      this.deselect(componentId);
    } else {
      this.select(componentId);
    }
  }

  /**
   * Clear all selections
   */
  clear(): void {
    this.selectedComponents.clear();
  }

  /**
   * Check if a component is selected
   */
  isSelected(componentId: string): boolean {
    return this.selectedComponents.has(componentId);
  }

  /**
   * Get all selected component IDs
   */
  getSelectedIds(): string[] {
    return Array.from(this.selectedComponents);
  }

  /**
   * Get count of selected components
   */
  getCount(): number {
    return this.selectedComponents.size;
  }

  /**
   * Select multiple components
   */
  selectMultiple(componentIds: string[]): void {
    componentIds.forEach((id) => this.select(id));
  }

  /**
   * Set selection to specific components (replaces existing)
   */
  setSelection(componentIds: string[]): void {
    this.clear();
    this.selectMultiple(componentIds);
  }

  /**
   * Update visual selection state of components
   */
  updateComponentsVisualState(components: CanvasComponent[]): void {
    components.forEach((component) => {
      component.isSelected = this.isSelected(component.id);
    });
  }
}
