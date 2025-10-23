/**
 * StateManager - Central state management for the application
 * Maintains application state and notifies listeners of changes
 */

import { AppState, PatchData, ViewportState } from './types';
import { eventBus } from './EventBus';
import { EventType } from './types';

/**
 * StateManager class for managing application state
 */
export class StateManager {
  private state: AppState;

  constructor() {
    this.state = this.getInitialState();
  }

  /**
   * Get the initial state of the application
   * @returns Initial application state
   */
  private getInitialState(): AppState {
    return {
      currentPatch: null,
      selectedComponentIds: [],
      isDirty: false,
      audioContextState: 'suspended',
      viewport: {
        zoom: 1.0,
        panX: 0,
        panY: 0,
      },
    };
  }

  /**
   * Get the current state
   * @returns Current application state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Get the current patch
   * @returns Current patch or null
   */
  getCurrentPatch(): PatchData | null {
    return this.state.currentPatch;
  }

  /**
   * Set the current patch
   * @param patch - Patch data to set
   */
  setCurrentPatch(patch: PatchData | null): void {
    this.state.currentPatch = patch;
    this.state.isDirty = false;
    eventBus.emit(EventType.PATCH_LOADED, patch);
  }

  /**
   * Get selected component IDs
   * @returns Array of selected component IDs
   */
  getSelectedComponentIds(): string[] {
    return [...this.state.selectedComponentIds];
  }

  /**
   * Set selected component IDs
   * @param ids - Array of component IDs to select
   */
  setSelectedComponentIds(ids: string[]): void {
    this.state.selectedComponentIds = [...ids];
    eventBus.emit(EventType.COMPONENT_SELECTED, { componentIds: ids });
  }

  /**
   * Add a component ID to the selection
   * @param id - Component ID to add
   */
  addToSelection(id: string): void {
    if (!this.state.selectedComponentIds.includes(id)) {
      this.state.selectedComponentIds.push(id);
      eventBus.emit(EventType.COMPONENT_SELECTED, { componentId: id });
    }
  }

  /**
   * Remove a component ID from the selection
   * @param id - Component ID to remove
   */
  removeFromSelection(id: string): void {
    const index = this.state.selectedComponentIds.indexOf(id);
    if (index !== -1) {
      this.state.selectedComponentIds.splice(index, 1);
      eventBus.emit(EventType.COMPONENT_DESELECTED, { componentId: id });
    }
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.state.selectedComponentIds = [];
    eventBus.emit(EventType.COMPONENT_DESELECTED, {});
  }

  /**
   * Check if a component is selected
   * @param id - Component ID to check
   * @returns True if component is selected
   */
  isComponentSelected(id: string): boolean {
    return this.state.selectedComponentIds.includes(id);
  }

  /**
   * Mark the patch as dirty (unsaved changes)
   */
  markDirty(): void {
    this.state.isDirty = true;
  }

  /**
   * Mark the patch as clean (saved)
   */
  markClean(): void {
    this.state.isDirty = false;
  }

  /**
   * Check if there are unsaved changes
   * @returns True if there are unsaved changes
   */
  isDirty(): boolean {
    return this.state.isDirty;
  }

  /**
   * Set the audio context state
   * @param state - Audio context state
   */
  setAudioContextState(state: AudioContextState): void {
    this.state.audioContextState = state;
  }

  /**
   * Get the audio context state
   * @returns Audio context state
   */
  getAudioContextState(): AudioContextState {
    return this.state.audioContextState;
  }

  /**
   * Get the viewport state
   * @returns Viewport state
   */
  getViewport(): ViewportState {
    return { ...this.state.viewport };
  }

  /**
   * Set the viewport state
   * @param viewport - Viewport state
   */
  setViewport(viewport: Partial<ViewportState>): void {
    this.state.viewport = {
      ...this.state.viewport,
      ...viewport,
    };
    eventBus.emit(EventType.VIEWPORT_CHANGED, this.state.viewport);
  }

  /**
   * Reset the viewport to default
   */
  resetViewport(): void {
    this.state.viewport = {
      zoom: 1.0,
      panX: 0,
      panY: 0,
    };
    eventBus.emit(EventType.VIEWPORT_CHANGED, this.state.viewport);
  }

  /**
   * Clear the current patch and reset state
   */
  clearPatch(): void {
    this.state.currentPatch = null;
    this.state.selectedComponentIds = [];
    this.state.isDirty = false;
    eventBus.emit(EventType.PATCH_CLEARED);
  }

  /**
   * Reset all state to initial values
   */
  reset(): void {
    this.state = this.getInitialState();
  }
}

// Export singleton instance
export const stateManager = new StateManager();
