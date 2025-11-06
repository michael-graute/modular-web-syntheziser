# Quickstart Guide: Startup Welcome Dialog

**Feature**: 004-startup-welcome-dialog
**Date**: 2025-11-06
**For**: Developers implementing this feature

## Overview

This guide provides a step-by-step walkthrough for implementing the Startup Welcome Dialog feature. Follow these instructions to integrate the welcome dialog into the application.

---

## Prerequisites

- Familiarity with TypeScript and ES6+ syntax
- Understanding of async/await patterns
- Knowledge of localStorage API
- Familiarity with the existing Modal base class

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         main.ts                              │
│                                                               │
│  init() ──> checkAndShowWelcomeDialog() ──> Promise<bool>  │
│                         │                                     │
│                         ├── AcceptanceStorage                │
│                         │   └── localStorage / memory        │
│                         │                                     │
│                         └── WelcomeDialog                    │
│                             └── Modal (base class)           │
└─────────────────────────────────────────────────────────────┘
```

**Key Components**:
1. **AcceptanceStorage**: localStorage utility for acceptance persistence
2. **WelcomeDialog**: Modal UI component (extends Modal base class)
3. **Integration**: Initialization check in main.ts

---

## Step 1: Create AcceptanceStorage Utility

**File**: `src/storage/AcceptanceStorage.ts` (NEW)

```typescript
/**
 * AcceptanceStorage - Manages terms acceptance persistence
 */

import { isLocalStorageAvailable } from '../utils/validators';

export interface AcceptanceRecord {
  accepted: boolean;
  version: string;
  timestamp: string;
}

export class AcceptanceStorage {
  private static readonly STORAGE_KEY = 'modular-synth:terms-acceptance';
  private static readonly CURRENT_VERSION = '1.0';
  private static sessionMemory: AcceptanceRecord | null = null;

  /**
   * Get current acceptance record
   */
  static getAcceptance(): AcceptanceRecord | null {
    // Try localStorage first
    if (isLocalStorageAvailable()) {
      try {
        const json = localStorage.getItem(this.STORAGE_KEY);
        if (json) {
          const record = JSON.parse(json);
          if (this.isValid(record)) {
            return record;
          }
        }
      } catch (error) {
        console.warn('Failed to read acceptance record:', error);
      }
    }

    // Fallback to session memory
    return this.sessionMemory;
  }

  /**
   * Save acceptance record
   */
  static saveAcceptance(accepted: boolean): boolean {
    const record: AcceptanceRecord = {
      accepted,
      version: this.CURRENT_VERSION,
      timestamp: new Date().toISOString(),
    };

    // Try localStorage
    if (isLocalStorageAvailable()) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(record));
        console.log(`✅ Terms acceptance saved: ${accepted}`);
        return true;
      } catch (error) {
        console.warn('Failed to save acceptance record:', error);
      }
    }

    // Fallback to session memory
    this.sessionMemory = record;
    console.warn('⚠️  Terms acceptance saved to session memory only (not persistent)');
    return false;
  }

  /**
   * Check if current version is accepted
   */
  static hasValidAcceptance(): boolean {
    const record = this.getAcceptance();
    return record !== null &&
           record.accepted &&
           record.version === this.CURRENT_VERSION;
  }

  /**
   * Clear acceptance (for testing)
   */
  static clearAcceptance(): void {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    this.sessionMemory = null;
  }

  /**
   * Validate acceptance record structure
   */
  private static isValid(record: any): record is AcceptanceRecord {
    return (
      record !== null &&
      typeof record === 'object' &&
      typeof record.accepted === 'boolean' &&
      typeof record.version === 'string' &&
      record.version.length > 0 &&
      typeof record.timestamp === 'string' &&
      !isNaN(Date.parse(record.timestamp))
    );
  }
}
```

**Testing**:
```typescript
// Test in browser console
AcceptanceStorage.saveAcceptance(true);
console.log(AcceptanceStorage.getAcceptance()); // Should show record
console.log(AcceptanceStorage.hasValidAcceptance()); // Should be true
AcceptanceStorage.clearAcceptance(); // Reset for testing
```

---

## Step 2: Create WelcomeDialog Component

**File**: `src/ui/WelcomeDialog.ts` (NEW)

```typescript
/**
 * WelcomeDialog - Modal for terms and conditions acceptance
 */

import { Modal, ModalOptions } from './Modal';

export interface WelcomeDialogOptions extends ModalOptions {
  reviewMode?: boolean;
}

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
```

**Testing**:
```typescript
// Test in browser console
const dialog = new WelcomeDialog();
dialog.onAccept(() => console.log('Accepted!'));
dialog.onDecline(() => console.log('Declined!'));
dialog.open();
```

---

## Step 3: Integrate into main.ts

**File**: `src/main.ts` (MODIFY)

Add imports at top:
```typescript
import { AcceptanceStorage } from './storage/AcceptanceStorage';
import { WelcomeDialog } from './ui/WelcomeDialog';
```

Add helper function before `init()`:
```typescript
/**
 * Check acceptance and show welcome dialog if needed
 */
async function checkAndShowWelcomeDialog(): Promise<boolean> {
  // Check if already accepted current version
  if (AcceptanceStorage.hasValidAcceptance()) {
    console.log('✅ Terms already accepted');
    return true;
  }

  console.log('📋 Showing welcome dialog...');

  // Show dialog and wait for user decision
  return new Promise((resolve) => {
    const dialog = new WelcomeDialog();

    dialog.onAccept(() => {
      AcceptanceStorage.saveAcceptance(true);
      resolve(true);
    });

    dialog.onDecline(() => {
      AcceptanceStorage.saveAcceptance(false);
      resolve(false);
    });

    dialog.open();
  });
}
```

Modify `init()` function:
```typescript
async function init(): Promise<void> {
  // CHECK TERMS ACCEPTANCE FIRST
  const accepted = await checkAndShowWelcomeDialog();
  if (!accepted) {
    showError('You must accept the terms and conditions to use this application.');
    return;
  }

  // Continue with existing initialization...
  if (!isWebAudioSupported()) {
    // ... rest of existing code
  }
}
```

---

## Step 4: Add "View Terms" Menu Option (P2)

**File**: `index.html` (MODIFY)

Add button after Help button:
```html
<button id="btn-terms">Terms</button>
```

**File**: `src/main.ts` (MODIFY)

In `setupPatchManagement()` function, add:
```typescript
// Terms button (P2: View terms in review mode)
const btnTerms = document.getElementById('btn-terms');
if (btnTerms) {
  btnTerms.addEventListener('click', () => {
    const dialog = new WelcomeDialog({ reviewMode: true });
    dialog.open();
  });
}
```

---

## Step 5: Testing Checklist

### Manual Testing

- [ ] **First Launch**:
  1. Clear localStorage: `localStorage.clear()`
  2. Refresh page
  3. Welcome dialog should appear
  4. Click "Accept" → app initializes
  5. Refresh page → dialog should NOT appear

- [ ] **Decline Flow**:
  1. Clear localStorage
  2. Refresh page
  3. Click "Decline" → error message shown, app doesn't initialize
  4. Refresh page → dialog appears again

- [ ] **Review Mode** (P2):
  1. Accept terms (first launch)
  2. Click "Terms" button in top bar
  3. Dialog opens in non-blocking mode
  4. Can close with Close button, Escape, or overlay click

- [ ] **Version Update**:
  1. Accept terms (version 1.0)
  2. Change `CURRENT_VERSION` to "1.1" in AcceptanceStorage.ts
  3. Refresh page → dialog should appear again

- [ ] **localStorage Disabled**:
  1. Disable localStorage in browser (incognito mode or dev tools)
  2. Refresh page → dialog appears
  3. Accept → warning logged about session memory
  4. Refresh page → dialog appears again (not persistent)

### Accessibility Testing

- [ ] **Keyboard Navigation**:
  - Tab through buttons (Close, Accept, Decline)
  - Enter key activates buttons
  - Focus visible on all interactive elements

- [ ] **Screen Reader**:
  - Dialog announced when opened
  - Title and content read correctly
  - Buttons have clear labels

### Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Troubleshooting

### Dialog doesn't appear on first launch

**Check**:
1. Is `checkAndShowWelcomeDialog()` called before other init code?
2. Is there an existing acceptance record in localStorage?
3. Open browser console and check for errors

**Solution**:
```javascript
// Clear acceptance and test again
localStorage.removeItem('modular-synth:terms-acceptance');
location.reload();
```

### Dialog appears every time

**Check**:
1. Is localStorage available? Check `isLocalStorageAvailable()`
2. Is acceptance being saved? Check console logs

**Solution**:
- If in incognito mode: Expected behavior (no persistence)
- If localStorage is blocked: Check browser settings

### Buttons don't work

**Check**:
1. Are callbacks registered before `dialog.open()`?
2. Check browser console for JavaScript errors

**Solution**:
```typescript
// Ensure callback order:
dialog.onAccept(() => { /* ... */ });
dialog.onDecline(() => { /* ... */ });
dialog.open(); // Call open() AFTER registering callbacks
```

---

## Performance Considerations

- **Initial Load Impact**: ~0.1ms (localStorage read)
- **Dialog Rendering**: Uses existing Modal fade-in (~200ms)
- **Storage Write**: Synchronous localStorage.setItem (~1-5ms)

**Optimization**:
- Content is inline HTML (no network requests)
- No images or external assets
- Minimal CSS (reuses Modal styles)

---

## Future Enhancements

### Adding Analytics
```typescript
// In handleAccept():
eventBus.emit(EventType.TERMS_ACCEPTED, {
  version: AcceptanceStorage.CURRENT_VERSION,
  timestamp: new Date().toISOString(),
});
```

### Localizing Content
```typescript
import { getLocale } from './i18n';

const content = getTermsContent(getLocale()); // 'en', 'de', etc.
```

### External Terms Loading
```typescript
async function loadTermsFromServer(): Promise<string> {
  const response = await fetch('/api/terms/latest');
  return response.text();
}
```

---

## Summary

You've implemented:
- ✅ AcceptanceStorage for localStorage persistence
- ✅ WelcomeDialog component extending Modal base class
- ✅ Integration into main.ts initialization flow
- ✅ "View Terms" menu option (P2)
- ✅ Graceful degradation for localStorage issues
- ✅ Version tracking for terms updates

**Next Step**: Run `/speckit.tasks` to generate detailed implementation tasks.
