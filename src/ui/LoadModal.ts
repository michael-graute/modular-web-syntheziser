/**
 * LoadModal - Modal dialog for loading patches
 */

import { Modal } from './Modal';
import { patchManager } from '../patch/PatchManager';
import type { PatchMetadata } from '../patch/PatchStorage';

/**
 * Modal for loading patches
 */
export class LoadModal extends Modal {
  private patchList: HTMLDivElement;
  private onLoadCallback: ((name: string) => void) | null;
  private onDeleteCallback: ((name: string) => void) | null;
  private fileInput: HTMLInputElement;

  constructor() {
    super({
      title: 'Load Patch',
      width: '600px',
      height: '500px',
    });

    this.onLoadCallback = null;
    this.onDeleteCallback = null;
    this.patchList = this.createPatchList();
    this.fileInput = this.createFileInput();
    this.setupContent();
  }

  /**
   * Create patch list container
   */
  private createPatchList(): HTMLDivElement {
    const list = document.createElement('div');
    list.className = 'patch-list';
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 100%;
      overflow-y: auto;
    `;
    return list;
  }

  /**
   * Create hidden file input for importing
   */
  private createFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.handleImport(file);
      }
    });

    return input;
  }

  /**
   * Setup modal content
   */
  private setupContent(): void {
    const body = this.getBody();
    body.innerHTML = '';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';

    // Info text
    const info = document.createElement('p');
    info.textContent = 'Select a patch to load:';
    info.style.cssText = `
      margin: 0 0 12px 0;
      color: var(--text-secondary, #aaa);
    `;

    body.appendChild(info);
    body.appendChild(this.patchList);
    body.appendChild(this.fileInput);

    // Refresh patch list
    this.refreshPatchList();

    // Add buttons
    this.clearButtons();
    this.addButton('Import File', () => this.openFileDialog(), 'secondary');
    this.addButton('Close', () => this.close(), 'secondary');
  }

  /**
   * Refresh the patch list
   */
  private refreshPatchList(): void {
    this.patchList.innerHTML = '';

    const patches = patchManager.listPatches();

    if (patches.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No saved patches found';
      emptyMessage.style.cssText = `
        padding: 40px 20px;
        text-align: center;
        color: var(--text-secondary, #aaa);
        font-style: italic;
      `;
      this.patchList.appendChild(emptyMessage);
      return;
    }

    // Create patch items
    for (const patch of patches) {
      const item = this.createPatchItem(patch);
      this.patchList.appendChild(item);
    }
  }

  /**
   * Create a patch list item
   */
  private createPatchItem(patch: PatchMetadata): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'patch-item';
    item.style.cssText = `
      padding: 12px;
      border: 1px solid var(--border-color, #444);
      border-radius: 4px;
      background: var(--bg-secondary, #1a1a1a);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Info section
    const info = document.createElement('div');
    info.style.cssText = 'flex: 1;';

    const name = document.createElement('div');
    name.textContent = patch.name;
    name.style.cssText = `
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 4px;
      color: var(--text-primary, #ffffff);
    `;

    const meta = document.createElement('div');
    const modifiedDate = new Date(patch.modified);
    const formattedDate = modifiedDate.toLocaleDateString() + ' ' + modifiedDate.toLocaleTimeString();
    meta.textContent = `${patch.componentCount} components, ${patch.connectionCount} connections • Modified: ${formattedDate}`;
    meta.style.cssText = `
      font-size: 0.75rem;
      color: var(--text-secondary, #aaa);
    `;

    info.appendChild(name);
    info.appendChild(meta);

    // Actions section
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.2s;
    `;

    const loadButton = document.createElement('button');
    loadButton.textContent = 'Load';
    loadButton.style.cssText = `
      padding: 6px 12px;
      border-radius: 4px;
      border: none;
      background: var(--accent-color, #0066cc);
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    `;

    loadButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleLoad(patch.name);
    });

    loadButton.addEventListener('mouseenter', () => {
      loadButton.style.background = 'var(--accent-hover, #0052a3)';
    });

    loadButton.addEventListener('mouseleave', () => {
      loadButton.style.background = 'var(--accent-color, #0066cc)';
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.style.cssText = `
      padding: 6px 12px;
      border-radius: 4px;
      border: none;
      background: #dc3545;
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    `;

    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleDelete(patch.name);
    });

    deleteButton.addEventListener('mouseenter', () => {
      deleteButton.style.background = '#c82333';
    });

    deleteButton.addEventListener('mouseleave', () => {
      deleteButton.style.background = '#dc3545';
    });

    actions.appendChild(loadButton);
    actions.appendChild(deleteButton);

    item.appendChild(info);
    item.appendChild(actions);

    // Show actions on hover
    item.addEventListener('mouseenter', () => {
      item.style.borderColor = 'var(--accent-color, #0066cc)';
      item.style.background = 'var(--bg-hover, #252525)';
      actions.style.opacity = '1';
    });

    item.addEventListener('mouseleave', () => {
      item.style.borderColor = 'var(--border-color, #444)';
      item.style.background = 'var(--bg-secondary, #1a1a1a)';
      actions.style.opacity = '0';
    });

    // Click anywhere on item to load
    item.addEventListener('click', () => {
      this.handleLoad(patch.name);
    });

    return item;
  }

  /**
   * Handle load action
   */
  private handleLoad(name: string): void {
    if (this.onLoadCallback) {
      this.onLoadCallback(name);
    }
    this.close();
  }

  /**
   * Handle delete action
   */
  private handleDelete(name: string): void {
    const confirmed = confirm(`Are you sure you want to delete patch "${name}"?`);
    if (confirmed) {
      if (this.onDeleteCallback) {
        this.onDeleteCallback(name);
      }
      // Refresh list after deletion
      this.refreshPatchList();
    }
  }

  /**
   * Open file dialog for import
   */
  private openFileDialog(): void {
    this.fileInput.click();
  }

  /**
   * Handle file import
   */
  private async handleImport(file: File): Promise<void> {
    const success = await patchManager.importFromFile(file);
    if (success) {
      this.close();
    }
  }

  /**
   * Override open to refresh list
   */
  override open(): void {
    this.refreshPatchList();
    super.open();
  }

  /**
   * Set load callback
   */
  onLoad(callback: (name: string) => void): void {
    this.onLoadCallback = callback;
  }

  /**
   * Set delete callback
   */
  onDelete(callback: (name: string) => void): void {
    this.onDeleteCallback = callback;
  }
}
