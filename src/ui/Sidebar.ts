/**
 * Sidebar - Component library UI
 */

import { ComponentType, EventType } from '../core/types';
import { componentRegistry } from '../components/ComponentRegistry';
import { eventBus } from '../core/EventBus';

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

    // Touch tap-to-add: place component at canvas centre when tapped on touch device
    item.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      e.preventDefault();
      const canvasEl = document.getElementById('synth-canvas');
      const rect = canvasEl?.getBoundingClientRect();
      const position = rect
        ? { x: rect.width / 2, y: rect.height / 2 }
        : { x: 400, y: 300 };
      eventBus.emit(EventType.COMPONENT_ADD_REQUESTED, {
        componentType: data.type,
        position,
      });
      // Close sidebar after adding on touch
      document.querySelector('.sidebar')?.classList.remove('sidebar--open');
    });

    return item;
  }

  /**
   * Get icon for component type
   */
  private getComponentIcon(type: ComponentType): string {
    const icons: Record<ComponentType, string> = {
      [ComponentType.OSCILLATOR]: '〜',
      [ComponentType.FM_OSCILLATOR]: '〜',
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
      [ComponentType.STEP_SEQUENCER]: '▦',
      [ComponentType.COLLIDER]: '●',
      [ComponentType.CHORD_FINDER]: '♬',
      [ComponentType.LOOPER]: '⊙',
      [ComponentType.BITCRUSHER]: '▓',
      [ComponentType.FLANGER]: '〜',
      [ComponentType.PHASER]: '◎',
      [ComponentType.TREMOLO]: '∿',
      [ComponentType.QUANTIZER]: '♯',
      [ComponentType.PARAMETRIC_EQ]: '♩',
      [ComponentType.VU_METER]: '▌',
      [ComponentType.RING_MODULATOR]: '⊗',
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
