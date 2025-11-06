# Research: Startup Welcome Dialog

**Feature**: 004-startup-welcome-dialog
**Date**: 2025-11-06
**Status**: Complete

## Overview

This document contains research findings that resolve the unknowns identified in the implementation plan. Each section provides decisions, rationale, and alternatives considered.

---

## 1. Application Initialization Flow

### Decision

The welcome dialog check will be injected at the **very beginning of the `init()` function** in `/src/main.ts`, immediately after the function declaration but before any browser compatibility checks.

### Rationale

**Current initialization sequence**:
1. DOM ready check (`document.readyState`)
2. `init()` function starts
3. Browser compatibility checks (`isWebAudioSupported`, `isLocalStorageAvailable`)
4. Factory patches loading
5. Component registration
6. Sidebar initialization
7. Audio engine init
8. Canvas init
9. Keyboard init
10. Patch management setup

**Injection point logic**:
- **Before browser checks**: We want to show the welcome dialog even if Web Audio is not supported, to provide a professional first impression and legal coverage
- **After DOM ready**: We need the DOM to exist to create and show the modal
- **Non-blocking**: The dialog will be modal and block all UI interaction, so the rest of init() should only proceed after acceptance

### Implementation approach

```typescript
async function init(): Promise<void> {
  // INJECT HERE: Check terms acceptance before anything else
  const accepted = await checkAndShowWelcomeDialog();
  if (!accepted) {
    // User declined - show message and halt initialization
    showError('You must accept the terms to use this application.');
    return;
  }

  // Continue with existing initialization...
  if (!isWebAudioSupported()) {
    // ...
  }
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Before `init()` at top level | Risks showing dialog before DOM is ready; harder to control async flow |
| After browser checks | Would show Web Audio error before welcome dialog, poor UX |
| After audio engine init | Too late - user has already started using the app |

---

## 2. Testing Strategy

### Decision

- **Unit Tests**: Use **Vitest** (Vite's native test runner) with mocked localStorage
- **Integration Tests**: Manual browser testing initially; Playwright E2E tests if integration becomes complex
- **Test Coverage Target**: 80%+ for AcceptanceStorage utility, 60%+ for WelcomeDialog (UI component)

### Rationale

**Vitest selection**:
- Already bundled with Vite ecosystem (minimal config)
- Native TypeScript support
- Fast with instant hot-reload for tests
- Familiar Jest-compatible API
- Built-in mocking utilities

**localStorage mocking approach**:
```typescript
// Mock setup for tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;
```

**Testing priorities**:
1. **AcceptanceStorage** (critical path):
   - First launch (no record)
   - Acceptance recorded
   - Rejection recorded
   - Corrupted data handling
   - Storage unavailable scenarios

2. **WelcomeDialog** (UI behavior):
   - Dialog opens/closes correctly
   - Accept button records acceptance
   - Decline button records rejection
   - Escape key handling (if enabled)
   - Content scrolling

3. **Integration** (manual first):
   - First launch flow end-to-end
   - Subsequent launch (no dialog)
   - Review mode (P2 requirement)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Jest | Requires additional setup; Vitest is Vite-native and faster |
| No tests | Violates constitution (80% coverage requirement) |
| Playwright only | Too slow for unit-level testing; overkill for localStorage logic |
| Browser-only testing | Not repeatable/automatable; doesn't meet CI/CD requirements |

---

## 3. Content & Formatting

### Decision

**Terms structure**:
```html
<div class="welcome-content">
  <section class="welcome-message">
    <h3>Welcome to Modular Synth</h3>
    <p>Description paragraph...</p>
  </section>

  <section class="terms-section">
    <h3>Terms and Conditions</h3>
    <h4>1. No Warranty</h4>
    <p>Standard disclaimer text...</p>

    <h4>2. Limitation of Liability</h4>
    <p>Standard disclaimer text...</p>

    <h4>3. License</h4>
    <p>MIT/Apache license reference...</p>
  </section>
</div>
```

**CSS for scrollable content**:
- Modal body already has `overflow-y: auto` from base Modal class
- Add max-height constraint: `max-height: 60vh` to ensure scrollability
- Typography:
  - Welcome: Larger, friendly font
  - Terms: Smaller, readable legal text (14px)
  - Line height: 1.6 for readability

**Standard open-source disclaimers** (based on MIT License):
```
NO WARRANTY: This software is provided "as is", without warranty of any kind,
express or implied, including but not limited to the warranties of
merchantability, fitness for a particular purpose and noninfringement.

NO LIABILITY: In no event shall the authors or copyright holders be liable
for any claim, damages or other liability, whether in an action of contract,
tort or otherwise, arising from, out of or in connection with the software
or the use or other dealings in the software.
```

### Rationale

- **Sectioned approach**: Clear visual separation between welcome and legal content
- **Standard disclaimers**: Legally recognized language from MIT/Apache licenses
- **Scrollable design**: Existing Modal class already supports overflow-y; just need to ensure content triggers it
- **Readability**: Legal text needs high readability despite smaller size

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Tabs (Welcome / Terms) | More complex UI; single scroll is simpler for acceptance flow |
| External link to terms | Not blocking; user could skip reading |
| Plain text in `<pre>` | Poor formatting; not web-native; accessibility issues |

---

## 4. Accessibility Standards

### Decision

Implement **WCAG 2.1 Level AA** compliance with focus management and ARIA attributes:

**ARIA attributes for modal**:
```typescript
this.modal.setAttribute('role', 'dialog');
this.modal.setAttribute('aria-modal', 'true');
this.modal.setAttribute('aria-labelledby', 'welcome-dialog-title');
this.modal.setAttribute('aria-describedby', 'welcome-dialog-description');
```

**Focus management**:
1. **On open**:
   - Trap focus within modal
   - Focus first interactive element (Accept button or scrollable body)
   - Store reference to element that had focus before modal opened

2. **On close**:
   - Restore focus to previously focused element
   - Remove focus trap

3. **Tab order**:
   - Close button (×) → Body content → Accept button → Decline button → Loop back

**Keyboard navigation**:
- **Tab/Shift+Tab**: Navigate between buttons
- **Enter**: Activate focused button
- **Escape**: Close (if enabled via options; may be disabled for blocking mode)
- **Arrow keys**: Scroll content when body is focused

**Screen reader support**:
- Use semantic HTML (`<h2>`, `<section>`, `<button>`)
- Provide descriptive button labels
- Announce modal opening with `aria-live` region if needed

### Rationale

- **Focus trap**: Prevents keyboard users from escaping modal and accessing blocked content
- **ARIA attributes**: Ensures screen readers announce modal properly
- **Keyboard shortcuts**: Standard modal interaction patterns
- **Level AA**: Industry standard; meets constitution requirements

### Implementation approach

Extend base Modal class with focus trap:
```typescript
class WelcomeDialog extends Modal {
  private previousFocus: HTMLElement | null = null;

  open(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    super.open();
    this.trapFocus();
    this.focusFirstElement();
  }

  close(): void {
    super.close();
    this.releaseFocus();
    this.previousFocus?.focus();
  }

  private trapFocus(): void {
    // Implementation: listen for Tab/Shift+Tab and cycle through modal elements
  }
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| No focus management | Fails WCAG; keyboard users can escape modal |
| Only ARIA (no focus trap) | Insufficient; focus can still leave modal |
| Custom tab order with tabindex | Anti-pattern; semantic HTML + focus trap is cleaner |

---

## 5. Storage Edge Cases

### Decision

**Handle four edge cases**:

1. **localStorage disabled/unavailable**:
   - Detect with `isLocalStorageAvailable()` (already exists in codebase)
   - Fallback: Store acceptance in memory (session-only)
   - Show warning: "Terms acceptance will not persist. You'll need to accept again next session."

2. **Storage quota exceeded**:
   - Use same pattern as PatchStorage (already has quota checking)
   - Acceptance record is tiny (~100 bytes), so unlikely to fail
   - If it fails: Log warning, continue with session-only memory storage

3. **Incognito/private browsing**:
   - localStorage often available but doesn't persist
   - Use same fallback as disabled storage (session memory)
   - Accept this limitation (document in assumptions)

4. **Version tracking for terms updates**:
   - Store version number with acceptance record
   - Format: `{ accepted: true, version: "1.0", timestamp: "..." }`
   - On future updates: Check version; if outdated, show dialog again

### Rationale

**Graceful degradation**: App should work even if localStorage fails, just with reduced persistence.

**Version tracking**: Future-proofs for terms updates without complex migration logic.

**Consistent patterns**: Follows existing PatchStorage approach for quota/error handling.

### Implementation

```typescript
export interface AcceptanceRecord {
  accepted: boolean;
  version: string;  // e.g., "1.0"
  timestamp: string; // ISO date string
}

export class AcceptanceStorage {
  private static readonly STORAGE_KEY = 'modular-synth:terms-acceptance';
  private static readonly CURRENT_VERSION = '1.0';
  private static sessionMemory: AcceptanceRecord | null = null;

  static getAcceptance(): AcceptanceRecord | null {
    // Try localStorage first
    if (isLocalStorageAvailable()) {
      try {
        const json = localStorage.getItem(this.STORAGE_KEY);
        if (json) {
          const record = JSON.parse(json);
          // Check version
          if (record.version === this.CURRENT_VERSION) {
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
        return true;
      } catch (error) {
        console.warn('Failed to save acceptance record:', error);
      }
    }

    // Fallback to session memory
    this.sessionMemory = record;
    console.warn('Terms acceptance saved to session memory only (not persistent)');
    return false;
  }
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Fail if localStorage unavailable | Blocks users in private browsing; poor UX |
| Cookies for fallback | More complex; GDPR implications; not needed |
| Always show dialog (no persistence) | Annoying for users; violates requirement |
| IndexedDB for storage | Overkill for single small record |

---

## 6. Integration Points

### Decision

**Main app initialization**:
```typescript
async function init(): Promise<void> {
  // 1. Check acceptance (blocking)
  const accepted = await checkAndShowWelcomeDialog();
  if (!accepted) {
    showError('You must accept the terms to use this application.');
    return; // Halt initialization
  }

  // 2. Continue with existing initialization
  // ...existing code...
}

async function checkAndShowWelcomeDialog(): Promise<boolean> {
  const record = AcceptanceStorage.getAcceptance();

  // Already accepted (correct version)
  if (record && record.accepted && record.version === CURRENT_VERSION) {
    return true;
  }

  // Need to show dialog
  const dialog = new WelcomeDialog();
  return new Promise((resolve) => {
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

**Menu integration for "View Terms" (P2)**:
- Add new button in top bar: "About" or "Terms"
- Position: After "Help" button
- Behavior: Opens WelcomeDialog in review mode (non-blocking, no acceptance required)

```typescript
// In setupPatchManagement() or similar
const btnTerms = document.getElementById('btn-terms');
if (btnTerms) {
  btnTerms.addEventListener('click', () => {
    const dialog = new WelcomeDialog({ reviewMode: true });
    dialog.open();
  });
}
```

**UI blocking approach**:
- **Modal overlay**: Prevents all interaction (existing Modal base class behavior)
- **No explicit disabling**: Modal's z-index and overlay handle blocking
- **Error state**: If declined, show error message and don't initialize app

### Rationale

**Blocking flow**: Using Promise-based acceptance check ensures clean async flow and prevents race conditions.

**Review mode**: Separate mode flag allows reusing same dialog component for P2 requirement.

**Menu placement**: "Terms" or "About" next to "Help" is conventional location for legal/info content.

**Error handling**: Clear messaging if user declines; no confusing half-initialized state.

### Implementation Checklist

- [ ] Create `WelcomeDialog` class extending `Modal`
- [ ] Create `AcceptanceStorage` utility class
- [ ] Add `checkAndShowWelcomeDialog()` helper function
- [ ] Inject check at top of `init()` in main.ts
- [ ] Add "Terms" button to top bar in index.html
- [ ] Wire button to open dialog in review mode
- [ ] Add welcome content text and terms text
- [ ] Style terms content (sections, typography)
- [ ] Implement focus trap for accessibility
- [ ] Add ARIA attributes to modal
- [ ] Write unit tests for AcceptanceStorage
- [ ] Write unit tests for WelcomeDialog
- [ ] Manual browser testing (first launch, subsequent launch, review mode)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Callback-based acceptance | Promises are cleaner for async flow |
| Disable UI elements manually | Modal overlay handles this; no need |
| Terms in Help sidebar | Doesn't meet "blocking on first launch" requirement |
| Settings panel for terms | Too deep; not prominent enough for first-time users |

---

## Summary

All research questions have been answered with concrete decisions:

1. **Initialization**: Inject at top of `init()`, before browser checks
2. **Testing**: Vitest with localStorage mocks, 80%+ coverage
3. **Content**: Sectioned HTML with standard MIT/Apache disclaimers
4. **Accessibility**: WCAG 2.1 AA with focus trap and ARIA
5. **Storage**: Graceful fallback to session memory, version tracking
6. **Integration**: Promise-based blocking check, menu button for review mode

Next phase: Data model and contracts generation.
