# Data Model: Startup Welcome Dialog

**Feature**: 004-startup-welcome-dialog
**Date**: 2025-11-06
**Status**: Complete

## Overview

This document defines the data structures used by the Startup Welcome Dialog feature. All types follow TypeScript conventions and are designed for localStorage persistence.

---

## Core Data Structures

### AcceptanceRecord

Represents a user's acceptance (or rejection) of the terms and conditions.

```typescript
/**
 * Record of user's terms and conditions acceptance
 */
export interface AcceptanceRecord {
  /**
   * Whether the user accepted the terms
   */
  accepted: boolean;

  /**
   * Version of terms that were accepted
   * Format: semantic version string (e.g., "1.0", "1.1")
   * Used to re-prompt users when terms are updated
   */
  version: string;

  /**
   * Timestamp when acceptance was recorded
   * Format: ISO 8601 date string
   */
  timestamp: string;
}
```

**Validation Rules**:
- `accepted`: boolean (true/false only)
- `version`: non-empty string matching semantic version pattern
- `timestamp`: valid ISO 8601 date string

**Example**:
```json
{
  "accepted": true,
  "version": "1.0",
  "timestamp": "2025-11-06T14:30:00.000Z"
}
```

**Storage Location**:
- **Primary**: localStorage key `modular-synth:terms-acceptance`
- **Fallback**: Session memory (in-memory object, non-persistent)

---

### WelcomeDialogOptions

Configuration options for the WelcomeDialog component.

```typescript
/**
 * Options for configuring the WelcomeDialog
 * Extends base ModalOptions from Modal class
 */
export interface WelcomeDialogOptions extends ModalOptions {
  /**
   * Whether dialog is in review mode (non-blocking)
   * When true:
   * - No acceptance is recorded
   * - Only "Close" button is shown (no Accept/Decline)
   * - User can close with Escape key or overlay click
   *
   * When false (default):
   * - First-time acceptance mode (blocking)
   * - Accept and Decline buttons shown
   * - Cannot close without making a choice
   */
  reviewMode?: boolean;
}
```

**Default Values**:
```typescript
{
  title: 'Welcome to Modular Synth',
  width: '600px',
  height: 'auto',
  closeOnOverlayClick: false, // Prevent accidental close on first launch
  closeOnEscape: false,        // Prevent escape during acceptance flow
  reviewMode: false,           // Default to first-time mode
}
```

**Review Mode Modifications**:
```typescript
// When reviewMode: true
{
  closeOnOverlayClick: true,   // Allow easy close
  closeOnEscape: true,          // Allow Escape key
}
```

---

## State Transitions

### AcceptanceRecord Lifecycle

```
[No Record Exists]
       |
       v
[Show Dialog] ──┬──> [User Accepts] ──> [Create Record: accepted=true]
                |
                └──> [User Declines] ──> [Create Record: accepted=false]

[Record Exists: accepted=true]
       |
       v
[Check Version] ──┬──> [Version Matches] ──> [Skip Dialog]
                  |
                  └──> [Version Outdated] ──> [Show Dialog Again]

[Record Exists: accepted=false]
       |
       v
[Show Dialog on Next Launch]
```

### Dialog State Machine

```
[INIT]
   |
   v
[Check localStorage] ──┬──> [Record Found & Valid] ──> [END: No Dialog]
                       |
                       └──> [No Record / Invalid / Outdated] ──> [OPEN Dialog]
                                                                         |
                                                                         v
                                                         [User Interaction]
                                                                         |
                              ┌──────────────────────────────────────────┼───────────────────────────────────┐
                              v                                          v                                   v
                       [Accept Clicked]                          [Decline Clicked]                   [Review Mode: Close]
                              |                                          |                                   |
                              v                                          v                                   v
              [Save: accepted=true] ────────> [Close Dialog] <───── [Save: accepted=false]         [Close (no save)]
                              |                      |                   |
                              v                      v                   v
                    [Resolve: true]          [Continue Init]    [Resolve: false]
                                                                         |
                                                                         v
                                                                 [Show Error & Halt]
```

---

## Relationships

### Component Relationships

```
┌────────────────────────────────────────────────────────────────┐
│                          main.ts                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ init()                                                    │  │
│  │   |                                                       │  │
│  │   v                                                       │  │
│  │ checkAndShowWelcomeDialog() ───────> Promise<boolean>   │  │
│  │   |                                                       │  │
│  │   ├──> AcceptanceStorage.getAcceptance()                │  │
│  │   │         |                                             │  │
│  │   │         v                                             │  │
│  │   │    localStorage / sessionMemory                       │  │
│  │   │                                                       │  │
│  │   └──> new WelcomeDialog()                               │  │
│  │         |                                                 │  │
│  │         v                                                 │  │
│  │    dialog.open() ───> Modal base class                   │  │
│  │                                                           │  │
│  │   (await user choice)                                    │  │
│  │         |                                                 │  │
│  │         v                                                 │  │
│  │   AcceptanceStorage.saveAcceptance()                     │  │
│  │         |                                                 │  │
│  │         v                                                 │  │
│  │    localStorage.setItem() / sessionMemory                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                      UI Components                              │
│                                                                  │
│  Top Bar Buttons:                                               │
│    [Help] [Terms] ───> Open WelcomeDialog(reviewMode: true)   │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
localStorage
    │
    │ read
    v
AcceptanceStorage.getAcceptance()
    │
    │ return AcceptanceRecord | null
    v
checkAndShowWelcomeDialog()
    │
    ├───> (if no record) ──> Show WelcomeDialog
    │                              │
    │                              │ user clicks Accept/Decline
    │                              v
    │                         AcceptanceStorage.saveAcceptance()
    │                              │
    │                              │ write
    │                              v
    │                         localStorage
    │
    └───> (if record exists) ──> Check version ──> Skip dialog or re-show
```

---

## Storage Schema

### localStorage Keys

| Key | Type | Description | Example Value |
|-----|------|-------------|---------------|
| `modular-synth:terms-acceptance` | JSON string | User's acceptance record | `{"accepted":true,"version":"1.0","timestamp":"2025-11-06T14:30:00.000Z"}` |

### Storage Size Estimates

| Entity | Size (bytes) | Notes |
|--------|--------------|-------|
| AcceptanceRecord | ~100 | Small JSON object; negligible storage impact |
| Total Feature Storage | ~100 | Single record only |

**Quota Considerations**:
- Feature uses <1% of typical 5MB localStorage quota
- Quota exceeded is unlikely but handled gracefully (fallback to session memory)
- No cleanup/migration needed

---

## Validation & Constraints

### AcceptanceRecord Validation

```typescript
function isValidAcceptanceRecord(record: any): record is AcceptanceRecord {
  return (
    record !== null &&
    typeof record === 'object' &&
    typeof record.accepted === 'boolean' &&
    typeof record.version === 'string' &&
    record.version.length > 0 &&
    typeof record.timestamp === 'string' &&
    !isNaN(Date.parse(record.timestamp)) // Valid ISO date
  );
}
```

### Version Comparison

```typescript
function isVersionCurrent(record: AcceptanceRecord, currentVersion: string): boolean {
  return record.version === currentVersion;
}
```

**Version Update Strategy**:
- When terms are updated, increment version (e.g., "1.0" → "1.1")
- On next app load, version check fails → dialog shown again
- Old acceptance record is overwritten with new version upon acceptance

---

## Error Handling

### Corrupted Data Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Invalid JSON in localStorage | `JSON.parse()` throws | Catch error, treat as no record, show dialog |
| Missing required fields | Validation function returns false | Treat as no record, show dialog |
| Invalid date format | `Date.parse()` returns NaN | Treat as no record, show dialog |
| Invalid version format | Type check fails | Treat as no record, show dialog |

### Storage Unavailable Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| localStorage disabled | `isLocalStorageAvailable()` returns false | Use session memory fallback |
| Quota exceeded | `localStorage.setItem()` throws QuotaExceededError | Use session memory fallback, log warning |
| Private browsing mode | localStorage exists but doesn't persist | Accept limitation, user sees dialog each session |

---

## Future Extensibility

### Potential Additions (Not in Current Scope)

1. **Analytics**:
   ```typescript
   interface AcceptanceRecord {
     accepted: boolean;
     version: string;
     timestamp: string;
     // Future: Analytics opt-in
     analyticsConsent?: boolean;
   }
   ```

2. **User Metadata**:
   ```typescript
   interface AcceptanceRecord {
     accepted: boolean;
     version: string;
     timestamp: string;
     // Future: Track user agent for support
     userAgent?: string;
   }
   ```

3. **Multiple Terms Types**:
   ```typescript
   interface AcceptanceRecord {
     terms: {
       general: { version: string; accepted: boolean; timestamp: string; };
       privacy?: { version: string; accepted: boolean; timestamp: string; };
       cookies?: { version: string; accepted: boolean; timestamp: string; };
     };
   }
   ```

**Note**: Current design accommodates simple additions without breaking changes, thanks to TypeScript's optional properties.

---

## Summary

This data model provides:
- **Simple structure**: Only one entity (AcceptanceRecord) needs persistence
- **Version tracking**: Built-in support for terms updates
- **Graceful degradation**: Fallback to session memory if storage fails
- **Validation**: Comprehensive checks for data integrity
- **Extensibility**: Room for future enhancements without breaking changes

The model aligns with existing codebase patterns (similar to PatchStorage) and follows TypeScript best practices.
