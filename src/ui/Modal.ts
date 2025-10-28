/**
 * Modal - Base class for modal dialogs
 */

/**
 * Modal configuration options
 */
export interface ModalOptions {
  title: string;
  width?: string;
  height?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

/**
 * Base Modal class for creating dialogs
 */
export class Modal {
  protected overlay: HTMLDivElement;
  protected modal: HTMLDivElement;
  protected header: HTMLDivElement;
  protected body: HTMLDivElement;
  protected footer: HTMLDivElement;
  protected closeButton: HTMLButtonElement;
  protected options: ModalOptions;
  protected isOpen: boolean;

  private onCloseCallback: (() => void) | null;

  constructor(options: ModalOptions) {
    this.options = {
      closeOnOverlayClick: true,
      closeOnEscape: true,
      width: '500px',
      height: 'auto',
      ...options,
    };

    this.isOpen = false;
    this.onCloseCallback = null;

    // Create modal elements
    this.overlay = this.createOverlay();
    this.modal = this.createModal();
    this.header = this.createHeader();
    this.body = this.createBody();
    this.footer = this.createFooter();
    this.closeButton = this.createCloseButton();

    // Assemble modal
    this.header.appendChild(this.closeButton);
    this.modal.appendChild(this.header);
    this.modal.appendChild(this.body);
    this.modal.appendChild(this.footer);
    this.overlay.appendChild(this.modal);

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Create overlay element
   */
  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;
    return overlay;
  }

  /**
   * Create modal container
   */
  private createModal(): HTMLDivElement {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
      background: var(--bg-primary, #2a2a2a);
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      width: ${this.options.width};
      height: ${this.options.height};
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
    `;
    return modal;
  }

  /**
   * Create header element
   */
  private createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid var(--border-color, #444);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;

    const title = document.createElement('h2');
    title.textContent = this.options.title;
    title.style.cssText = `
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary, #ffffff);
    `;

    header.appendChild(title);
    return header;
  }

  /**
   * Create body element
   */
  private createBody(): HTMLDivElement {
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = `
      padding: 20px;
      overflow-y: auto;
      flex: 1;
      color: var(--text-primary, #ffffff);
    `;
    return body;
  }

  /**
   * Create footer element
   */
  private createFooter(): HTMLDivElement {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.style.cssText = `
      padding: 20px;
      border-top: 1px solid var(--border-color, #444);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;
    `;
    return footer;
  }

  /**
   * Create close button
   */
  private createCloseButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'modal-close';
    button.innerHTML = '&times;';
    button.setAttribute('aria-label', 'Close');
    button.style.cssText = `
      background: none;
      border: none;
      color: var(--text-secondary, #aaa);
      font-size: 2rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = 'var(--bg-hover, #3a3a3a)';
      button.style.color = 'var(--text-primary, #ffffff)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'none';
      button.style.color = 'var(--text-secondary, #aaa)';
    });

    button.addEventListener('click', () => this.close());

    return button;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Close on overlay click
    if (this.options.closeOnOverlayClick) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }

    // Close on Escape key
    if (this.options.closeOnEscape) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      };
      document.addEventListener('keydown', handleEscape);
    }
  }

  /**
   * Open the modal
   */
  open(): void {
    if (this.isOpen) return;

    // Add to DOM if not already added
    if (!this.overlay.parentElement) {
      document.body.appendChild(this.overlay);
    }

    this.overlay.style.display = 'flex';
    this.isOpen = true;

    // Focus the modal for accessibility
    this.modal.focus();
  }

  /**
   * Close the modal
   */
  close(): void {
    if (!this.isOpen) return;

    this.overlay.style.display = 'none';
    this.isOpen = false;

    // Call close callback if set
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  /**
   * Set close callback
   */
  onClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  /**
   * Destroy the modal and remove from DOM
   */
  destroy(): void {
    this.close();
    if (this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
  }

  /**
   * Get the body element for adding custom content
   */
  getBody(): HTMLDivElement {
    return this.body;
  }

  /**
   * Get the footer element for adding buttons
   */
  getFooter(): HTMLDivElement {
    return this.footer;
  }

  /**
   * Add a button to the footer
   */
  protected addButton(
    text: string,
    onClick: () => void,
    variant: 'primary' | 'secondary' | 'danger' = 'secondary'
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = `modal-button modal-button-${variant}`;

    // Base button styles
    button.style.cssText = `
      padding: 8px 16px;
      border-radius: 4px;
      border: none;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 80px;
    `;

    // Variant-specific styles
    switch (variant) {
      case 'primary':
        button.style.background = 'var(--accent-color, #0066cc)';
        button.style.color = '#ffffff';
        button.addEventListener('mouseenter', () => {
          button.style.background = 'var(--accent-hover, #0052a3)';
        });
        button.addEventListener('mouseleave', () => {
          button.style.background = 'var(--accent-color, #0066cc)';
        });
        break;

      case 'danger':
        button.style.background = '#dc3545';
        button.style.color = '#ffffff';
        button.addEventListener('mouseenter', () => {
          button.style.background = '#c82333';
        });
        button.addEventListener('mouseleave', () => {
          button.style.background = '#dc3545';
        });
        break;

      case 'secondary':
      default:
        button.style.background = 'var(--bg-secondary, #3a3a3a)';
        button.style.color = 'var(--text-primary, #ffffff)';
        button.addEventListener('mouseenter', () => {
          button.style.background = 'var(--bg-hover, #4a4a4a)';
        });
        button.addEventListener('mouseleave', () => {
          button.style.background = 'var(--bg-secondary, #3a3a3a)';
        });
        break;
    }

    button.addEventListener('click', onClick);
    this.footer.appendChild(button);

    return button;
  }

  /**
   * Clear all buttons from footer
   */
  protected clearButtons(): void {
    this.footer.innerHTML = '';
  }

  /**
   * Set modal size
   */
  setSize(width: string, height: string): void {
    this.modal.style.width = width;
    this.modal.style.height = height;
  }
}
