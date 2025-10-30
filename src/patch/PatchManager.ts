/**
 * PatchManager - Manages patch lifecycle including save/load/export
 */

import { PatchData, ComponentData, EventType } from '../core/types';
import { PatchSerializer } from './PatchSerializer';
import { PatchStorage } from './PatchStorage';
import { componentRegistry } from '../components/ComponentRegistry';
import { eventBus } from '../core/EventBus';
import type { Canvas } from '../canvas/Canvas';
import { CanvasComponent } from '../canvas/CanvasComponent';
import { calculateComponentDimensions } from '../utils/componentLayout';

/**
 * Manages the complete patch lifecycle
 */
export class PatchManager {
  private canvas: Canvas | null;
  private currentPatch: PatchData | null;
  private isDirty: boolean;

  constructor() {
    this.canvas = null;
    this.currentPatch = null;
    this.isDirty = false;

    this.setupEventListeners();
  }

  /**
   * Set the canvas instance for managing components
   */
  setCanvas(canvas: Canvas): void {
    this.canvas = canvas;
  }

  /**
   * Get the current patch
   */
  getCurrentPatch(): PatchData | null {
    return this.currentPatch;
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  /**
   * Mark the patch as dirty (has unsaved changes)
   */
  private markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Mark the patch as clean (saved)
   */
  private markClean(): void {
    this.isDirty = false;
  }

  /**
   * Setup event listeners for tracking changes
   */
  private setupEventListeners(): void {
    // Mark patch as dirty when changes occur
    eventBus.on(EventType.COMPONENT_ADDED, () => this.markDirty());
    eventBus.on(EventType.COMPONENT_REMOVED, () => this.markDirty());
    eventBus.on(EventType.COMPONENT_MOVED, () => this.markDirty());
    eventBus.on(EventType.PARAMETER_CHANGED, () => this.markDirty());
    eventBus.on(EventType.CONNECTION_ADDED, () => this.markDirty());
    eventBus.on(EventType.CONNECTION_REMOVED, () => this.markDirty());
  }

  /**
   * Create a new empty patch
   */
  newPatch(name: string = 'Untitled'): void {
    // Warn if there are unsaved changes
    if (this.isDirty) {
      const confirmed = confirm(
        'You have unsaved changes. Creating a new patch will discard them. Continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    // Clear the canvas
    this.clearCanvas();

    // Create new empty patch
    this.currentPatch = PatchSerializer.createEmptyPatch(name);
    this.markClean();

    eventBus.emit(EventType.PATCH_CLEARED);
    console.log(`📄 New patch created: "${name}"`);
  }

  /**
   * Save the current patch
   */
  save(patchName?: string): boolean {
    if (!this.canvas) {
      console.error('Canvas not set');
      return false;
    }

    // Get current state from canvas
    const components = this.canvas.getComponents();
    const connectionManager = (this.canvas as any).connectionManager;
    const connections = connectionManager.getConnections();

    // Get synth components
    const synthComponents = components
      .map((c) => c.getSynthComponent())
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Determine patch name
    const name = patchName || this.currentPatch?.name || 'Untitled';

    // Serialize patch
    const patchData = PatchSerializer.serializePatch(
      name,
      synthComponents,
      connections
    );

    // Save to storage
    const result = PatchStorage.save(patchData);

    if (result.success) {
      this.currentPatch = patchData;
      this.markClean();
      eventBus.emit(EventType.PATCH_SAVED);

      // Show quota warning if needed
      if (result.quotaWarning) {
        console.warn('⚠️ Storage quota warning: approaching 90% capacity');
      }

      console.log(`💾 Patch saved: "${name}"`);
      return true;
    } else {
      console.error(`Failed to save patch: ${result.error}`);
      alert(`Failed to save patch: ${result.error}`);
      return false;
    }
  }

  /**
   * Load a patch from storage
   */
  async load(patchName: string): Promise<boolean> {
    if (!this.canvas) {
      console.error('Canvas not set');
      return false;
    }

    // Warn if there are unsaved changes
    if (this.isDirty) {
      const confirmed = confirm(
        'You have unsaved changes. Loading a patch will discard them. Continue?'
      );
      if (!confirmed) {
        return false;
      }
    }

    // Load patch from storage
    const result = PatchStorage.load(patchName);

    if (!result.success || !result.patch) {
      console.error(`Failed to load patch: ${result.error}`);
      alert(`Failed to load patch: ${result.error}`);
      return false;
    }

    // Deserialize the patch
    return this.deserializePatch(result.patch);
  }

  /**
   * Deserialize and recreate a patch on the canvas
   */
  private async deserializePatch(patchData: PatchData): Promise<boolean> {
    if (!this.canvas) {
      console.error('Canvas not set');
      return false;
    }

    try {
      // Clear the canvas first
      this.clearCanvas();

      console.log(`📂 Loading patch: "${patchData.name}"`);
      console.log(
        `   Components: ${patchData.components.length}, Connections: ${patchData.connections.length}`
      );

      // Recreate components
      const componentMap = new Map<string, CanvasComponent>();

      for (const componentData of patchData.components) {
        const canvasComponent = await this.recreateComponent(componentData);
        if (canvasComponent) {
          componentMap.set(componentData.id, canvasComponent);
        } else {
          console.error(`Failed to recreate component: ${componentData.id}`);
        }
      }

      // Small delay to ensure all components are initialized
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Recreate connections
      const connectionManager = (this.canvas as any).connectionManager;
      for (const connectionData of patchData.connections) {
        const result = connectionManager.createConnection(
          connectionData.sourceComponentId,
          connectionData.sourcePortId,
          connectionData.targetComponentId,
          connectionData.targetPortId
        );

        if (!result.success) {
          console.warn(
            `Failed to recreate connection: ${result.error}`,
            connectionData
          );
        }
      }

      // Set as current patch
      this.currentPatch = patchData;
      this.markClean();

      eventBus.emit(EventType.PATCH_LOADED);
      console.log(`✅ Patch loaded successfully: "${patchData.name}"`);

      return true;
    } catch (error) {
      console.error('Failed to deserialize patch:', error);
      alert(`Failed to load patch: ${error}`);
      return false;
    }
  }

  /**
   * Recreate a single component from serialized data
   */
  private async recreateComponent(
    componentData: ComponentData
  ): Promise<CanvasComponent | null> {
    if (!this.canvas) {
      return null;
    }

    try {
      // Create synth component using registry
      const synthComponent = componentRegistry.create(
        componentData.type,
        componentData.id,
        componentData.position
      );

      if (!synthComponent) {
        console.error(`Failed to create component type: ${componentData.type}`);
        return null;
      }

      // Restore parameter values
      synthComponent.deserialize(componentData);

      // Create audio nodes
      synthComponent.activate();

      // Get component dimensions
      const dimensions = calculateComponentDimensions(componentData.type);

      // Create visual component
      const canvasComponent = new CanvasComponent(
        componentData.id,
        componentData.type,
        componentData.position,
        dimensions.width,
        dimensions.height
      );

      // Link components
      canvasComponent.setSynthComponent(synthComponent);

      // Add to canvas
      this.canvas.addComponent(canvasComponent);

      // Emit component added event for ModulationVisualizer tracking
      // This ensures CV visualization works when loading patches
      eventBus.emit(EventType.COMPONENT_ADDED, {
        component: canvasComponent,
      });

      return canvasComponent;
    } catch (error) {
      console.error('Error recreating component:', error);
      return null;
    }
  }

  /**
   * Clear all components from the canvas
   */
  private clearCanvas(): void {
    if (!this.canvas) {
      return;
    }

    const components = this.canvas.getComponents();
    const componentIds = components.map((c) => c.id);

    // Deactivate and remove all components
    for (const id of componentIds) {
      const component = components.find((c) => c.id === id);
      if (component) {
        const synthComponent = component.getSynthComponent();
        if (synthComponent) {
          synthComponent.deactivate();
        }
      }
      this.canvas.removeComponent(id);
    }

    console.log('🧹 Canvas cleared');
  }

  /**
   * Delete a patch from storage
   */
  deletePatch(patchName: string): boolean {
    const result = PatchStorage.delete(patchName);

    if (result.success) {
      // If we deleted the current patch, reset state
      if (this.currentPatch?.name === patchName) {
        this.currentPatch = null;
        this.markClean();
      }

      console.log(`🗑️ Patch deleted: "${patchName}"`);
      return true;
    } else {
      console.error(`Failed to delete patch: ${result.error}`);
      alert(`Failed to delete patch: ${result.error}`);
      return false;
    }
  }

  /**
   * List all saved patches
   */
  listPatches() {
    return PatchStorage.list();
  }

  /**
   * Export current patch to file
   */
  exportToFile(): boolean {
    if (!this.currentPatch && this.canvas) {
      // Create a temporary patch from current state
      const components = this.canvas.getComponents();
      const connectionManager = (this.canvas as any).connectionManager;
      const connections = connectionManager.getConnections();

      const synthComponents = components
        .map((c) => c.getSynthComponent())
        .filter((c): c is NonNullable<typeof c> => c !== null);

      this.currentPatch = PatchSerializer.serializePatch(
        'Exported Patch',
        synthComponents,
        connections
      );
    }

    if (!this.currentPatch) {
      alert('No patch to export');
      return false;
    }

    PatchStorage.exportToFile(this.currentPatch);
    return true;
  }

  /**
   * Import patch from file
   */
  async importFromFile(file: File): Promise<boolean> {
    if (!this.canvas) {
      console.error('Canvas not set');
      return false;
    }

    // Warn if there are unsaved changes
    if (this.isDirty) {
      const confirmed = confirm(
        'You have unsaved changes. Importing a patch will discard them. Continue?'
      );
      if (!confirmed) {
        return false;
      }
    }

    const result = await PatchStorage.importFromFile(file);

    if (result.success && result.patch) {
      // Load the imported patch
      return this.deserializePatch(result.patch);
    } else {
      console.error(`Failed to import patch: ${result.error}`);
      alert(`Failed to import patch: ${result.error}`);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats() {
    return PatchStorage.getStorageStats();
  }
}

// Export singleton instance
export const patchManager = new PatchManager();
