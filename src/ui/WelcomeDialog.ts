/**
 * WelcomeDialog - Modal for terms and conditions acceptance
 */

import { Modal, ModalOptions } from './Modal';

/**
 * Options for configuring the WelcomeDialog
 */
export interface WelcomeDialogOptions extends ModalOptions {
  /**
   * Whether dialog is in review mode (non-blocking)
   * When true: No acceptance required, only "Close" button shown
   * When false (default): First-time acceptance mode with Accept/Decline buttons
   */
  reviewMode?: boolean;
}

/**
 * Welcome dialog component extending Modal base class
 */
export class WelcomeDialog extends Modal {
  private acceptCallback: (() => void) | null = null;
  private declineCallback: (() => void) | null = null;
  private reviewMode: boolean;

  constructor(options?: Partial<WelcomeDialogOptions>) {
    const defaultOptions: WelcomeDialogOptions = {
      title: 'Welcome to Modular Synth',
      width: '600px',
      height: 'auto',
      closeOnOverlayClick: false,
      closeOnEscape: false,
      reviewMode: false,
      ...options,
    };

    // In review mode, allow easy closing
    if (defaultOptions.reviewMode) {
      defaultOptions.closeOnOverlayClick = true;
      defaultOptions.closeOnEscape = true;
    }

    super(defaultOptions);
    this.reviewMode = defaultOptions.reviewMode || false;

    this.setupContent();
    this.setupButtons();
  }

  /**
   * Setup welcome content and terms
   */
  private setupContent(): void {
    const body = this.getBody();

    body.innerHTML = `
      <div class="welcome-content" style="line-height: 1.6;">
        <section class="welcome-message" style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 1.1rem; color: var(--text-primary);">
            Welcome to Modular Synth
          </h3>
          <p style="margin: 0 0 8px 0;">
            Modular Synth is a browser-based modular synthesizer that brings the power of analog synthesis to your web browser.
          </p>
          <p style="margin: 0 0 8px 0;">
            Create complex sounds by connecting virtual modules, just like a hardware modular synthesizer. Experiment with oscillators, filters, envelopes, effects, and more.
          </p>
          <p style="margin: 0;">
            Before you begin, please review and accept our terms and conditions.
          </p>
        </section>

        <section class="terms-section" style="border-top: 1px solid var(--border-color); padding-top: 24px;">
          <h3 style="margin: 0 0 16px 0; font-size: 1rem; color: var(--text-primary);">
            Terms and Conditions
          </h3>

          <div style="font-size: 0.875rem; color: var(--text-secondary);">
            <h4 style="margin: 16px 0 8px 0; font-size: 0.9rem; font-weight: 600;">1. No Warranty</h4>
            <p style="margin: 0 0 12px 0;">
              This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement.
            </p>

            <h4 style="margin: 16px 0 8px 0; font-size: 0.9rem; font-weight: 600;">2. Limitation of Liability</h4>
            <p style="margin: 0 0 12px 0;">
              In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.
            </p>

            <h4 style="margin: 16px 0 8px 0; font-size: 0.9rem; font-weight: 600;">3. Open Source License</h4>
            <p style="margin: 0 0 12px 0;">
              This software is open source and distributed under the MIT License. You are free to use, modify, and distribute this software in accordance with the terms of the license.
            </p>

            <h4 style="margin: 16px 0 8px 0; font-size: 0.9rem; font-weight: 600;">4. User Responsibility</h4>
            <p style="margin: 0 0 12px 0;">
              You are responsible for your use of this software. Please be mindful of audio levels to protect your hearing and equipment.
            </p>
            <p style="margin: 0;">
              Audio synthesis can produce loud or unexpected sounds. Start with low volume levels and adjust carefully.
            </p>
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Setup Accept/Decline buttons or Close button
   */
  private setupButtons(): void {
    if (this.reviewMode) {
      // Review mode: Just a Close button
      this.addButton('Close', () => this.close(), 'secondary');
    } else {
      // First-time mode: Accept and Decline buttons
      this.addButton('Decline', () => this.handleDecline(), 'secondary');
      this.addButton('Accept', () => this.handleAccept(), 'primary');
    }
  }

  /**
   * Handle Accept button click
   */
  private handleAccept(): void {
    if (this.acceptCallback) {
      this.acceptCallback();
    }
    this.close();
  }

  /**
   * Handle Decline button click
   */
  private handleDecline(): void {
    if (this.declineCallback) {
      this.declineCallback();
    }
    this.close();
  }

  /**
   * Register callback for Accept
   */
  onAccept(callback: () => void): void {
    this.acceptCallback = callback;
  }

  /**
   * Register callback for Decline
   */
  onDecline(callback: () => void): void {
    this.declineCallback = callback;
  }
}
