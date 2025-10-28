/**
 * SaveModal - Modal dialog for saving patches
 */

import { Modal } from './Modal';
import { patchManager } from '../patch/PatchManager';

/**
 * Modal for saving patches
 */
export class SaveModal extends Modal {
  private nameInput: HTMLInputElement;
  private onSaveCallback: ((name: string) => void) | null;

  constructor() {
    super({
      title: 'Save Patch',
      width: '400px',
      height: 'auto',
    });

    this.onSaveCallback = null;
    this.nameInput = this.createNameInput();
    this.setupContent();
  }

  /**
   * Create name input field
   */
  private createNameInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter patch name...';
    input.className = 'modal-input';
    input.style.cssText = `
      width: 100%;
      padding: 10px;
      border: 1px solid var(--border-color, #444);
      border-radius: 4px;
      background: var(--bg-secondary, #1a1a1a);
      color: var(--text-primary, #ffffff);
      font-size: 1rem;
      box-sizing: border-box;
    `;

    input.addEventListener('focus', () => {
      input.style.borderColor = 'var(--accent-color, #0066cc)';
      input.style.outline = 'none';
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = 'var(--border-color, #444)';
    });

    // Handle Enter key to save
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSave();
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

    const label = document.createElement('label');
    label.textContent = 'Patch Name:';
    label.style.cssText = `
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: var(--text-primary, #ffffff);
    `;

    body.appendChild(label);
    body.appendChild(this.nameInput);

    // Add buttons
    this.clearButtons();
    this.addButton('Cancel', () => this.close(), 'secondary');
    this.addButton('Save', () => this.handleSave(), 'primary');
  }

  /**
   * Handle save action
   */
  private handleSave(): void {
    const name = this.nameInput.value.trim();

    if (!name) {
      alert('Please enter a patch name');
      this.nameInput.focus();
      return;
    }

    // Call save callback
    if (this.onSaveCallback) {
      this.onSaveCallback(name);
    }

    this.close();
  }

  /**
   * Open modal with optional default name
   */
  openWithName(defaultName?: string): void {
    // Set default name
    if (defaultName) {
      this.nameInput.value = defaultName;
    } else {
      const currentPatch = patchManager.getCurrentPatch();
      this.nameInput.value = currentPatch?.name || '';
    }

    this.open();

    // Focus input after a small delay to ensure it's visible
    setTimeout(() => {
      this.nameInput.focus();
      this.nameInput.select();
    }, 100);
  }

  /**
   * Set save callback
   */
  onSave(callback: (name: string) => void): void {
    this.onSaveCallback = callback;
  }
}
