/**
 * Sidebar - Component library UI
 */

import { ComponentType } from '../core/types';
import { componentRegistry } from '../components/ComponentRegistry';

/**
 * Component item data for drag-and-drop
 */
interface ComponentItem {
  type: ComponentType;
  name: string;
  description: string;
  category: string;
}

/**
 * Manages the sidebar component library
 */
export class Sidebar {
  private generatorsList: HTMLElement | null;
  private processorsList: HTMLElement | null;
  private effectsList: HTMLElement | null;
  private utilitiesList: HTMLElement | null;
  private analyzersList: HTMLElement | null;

  constructor() {
    this.generatorsList = document.getElementById('generators-list');
    this.processorsList = document.getElementById('processors-list');
    this.effectsList = document.getElementById('effects-list');
    this.utilitiesList = document.getElementById('utilities-list');
    this.analyzersList = document.getElementById('analyzers-list');
  }

  /**
   * Populate the sidebar with available components
   */
  populate(): void {
    const components = componentRegistry.getAllRegistrations();

    components.forEach((registration) => {
      const item = this.createComponentItem({
        type: registration.type,
        name: registration.name,
        description: registration.description,
        category: registration.category,
      });

      // Add to appropriate category list
      switch (registration.category) {
        case 'Generators':
          this.generatorsList?.appendChild(item);
          break;
        case 'Processors':
          this.processorsList?.appendChild(item);
          break;
        case 'Effects':
          this.effectsList?.appendChild(item);
          break;
        case 'Utilities':
          this.utilitiesList?.appendChild(item);
          break;
        case 'Analyzers':
          this.analyzersList?.appendChild(item);
          break;
      }
    });

    console.log(`📚 Populated sidebar with ${components.length} components`);
  }

  /**
   * Create a draggable component item
   */
  private createComponentItem(data: ComponentItem): HTMLElement {
    const item = document.createElement('div');
    item.className = 'component-item';
    item.draggable = true;
    item.setAttribute('data-component-type', data.type);

    // Component icon/visual
    const icon = document.createElement('div');
    icon.className = 'component-icon';
    icon.textContent = this.getComponentIcon(data.type);

    // Component info
    const info = document.createElement('div');
    info.className = 'component-info';

    const name = document.createElement('div');
    name.className = 'component-name';
    name.textContent = data.name;

    const description = document.createElement('div');
    description.className = 'component-description';
    description.textContent = data.description;

    info.appendChild(name);
    info.appendChild(description);

    item.appendChild(icon);
    item.appendChild(info);

    // Drag event handlers
    item.addEventListener('dragstart', (e) => this.handleDragStart(e, data));
    item.addEventListener('dragend', (e) => this.handleDragEnd(e));

    return item;
  }

  /**
   * Get icon for component type
   */
  private getComponentIcon(type: ComponentType): string {
    const icons: Record<ComponentType, string> = {
      [ComponentType.OSCILLATOR]: '〜',
      [ComponentType.LFO]: '≈',
      [ComponentType.NOISE]: '※',
      [ComponentType.FILTER]: '⊼',
      [ComponentType.VCA]: '◐',
      [ComponentType.ADSR_ENVELOPE]: '⌇',
      [ComponentType.FILTER_ENVELOPE]: '⌇',
      [ComponentType.DELAY]: '◷',
      [ComponentType.REVERB]: '◉',
      [ComponentType.DISTORTION]: '⚡',
      [ComponentType.CHORUS]: '♪',
      [ComponentType.MIXER]: '▤',
      [ComponentType.KEYBOARD_INPUT]: '⌨',
      [ComponentType.MASTER_OUTPUT]: '♫',
      [ComponentType.OSCILLOSCOPE]: '◰',
    };
    return icons[type] || '□';
  }

  /**
   * Handle drag start
   */
  private handleDragStart(e: DragEvent, data: ComponentItem): void {
    if (!e.dataTransfer) return;

    // Set drag data
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-component-type', data.type);
    e.dataTransfer.setData('text/plain', data.name);

    // Add dragging class
    (e.target as HTMLElement).classList.add('dragging');

    console.log(`🎯 Started dragging: ${data.name}`);
  }

  /**
   * Handle drag end
   */
  private handleDragEnd(e: DragEvent): void {
    // Remove dragging class
    (e.target as HTMLElement).classList.remove('dragging');
  }
}
