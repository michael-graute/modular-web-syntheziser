# Data Model: Factory Patches

**Feature**: 003-factory-patches
**Date**: 2025-10-31
**Status**: Complete

## Overview

Factory patches reuse the existing `PatchData` structure with minimal extensions. The primary addition is an optional `description` field for metadata. Factory patches are stored as static JSON files and loaded at runtime.

## Entities

### FactoryPatchMetadata (NEW)

Represents a factory patch with loading metadata.

**Attributes**:
- `filename`: string - The JSON filename (e.g., "bass-synth.json")
- `source`: 'factory' | 'user' - Discriminator for patch source
- `patch`: PatchData - The actual patch data
- `loadedAt`: Date - When the patch was loaded (for cache management)

**Purpose**: Wrapper around PatchData to track factory patch-specific metadata without modifying the core patch format.

**Example**:
```typescript
interface FactoryPatchMetadata {
  filename: string;
  source: 'factory';
  patch: PatchData;
  loadedAt: Date;
}
```

---

### PatchData (EXTENDED)

Extended version of existing interface to support optional description.

**New Attributes**:
- `description`: string (optional) - 1-2 sentence description of the patch sound

**Existing Attributes** (unchanged):
- `name`: string - Display name of the patch
- `version`: string - Patch format version (e.g., "1.0.0")
- `created`: string - ISO timestamp of creation
- `modified`: string - ISO timestamp of last modification
- `components`: ComponentData[] - Array of synth components
- `connections`: Connection[] - Array of signal connections

**Validation Rules**:
- `name` must not be empty
- `version` must follow semver format (x.y.z)
- `description` if present must be 1-500 characters
- `components` and `connections` must be valid arrays (existing validation)

**Example Factory Patch**:
```json
{
  "name": "Bass Synth",
  "version": "1.0.0",
  "description": "A warm bass sound using a sawtooth oscillator and lowpass filter with moderate resonance.",
  "created": "2025-10-31T00:00:00Z",
  "modified": "2025-10-31T00:00:00Z",
  "components": [
    {
      "id": "osc-1",
      "type": "OSCILLATOR",
      "position": { "x": 100, "y": 100 },
      "parameters": {
        "waveform": 2,
        "frequency": 55,
        "detune": 0
      }
    },
    {
      "id": "filter-1",
      "type": "FILTER",
      "position": { "x": 300, "y": 100 },
      "parameters": {
        "type": 0,
        "cutoff": 800,
        "resonance": 0.7
      }
    },
    {
      "id": "master-1",
      "type": "MASTER_OUTPUT",
      "position": { "x": 500, "y": 100 },
      "parameters": {
        "volume": 0.8
      }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "sourceId": "osc-1",
      "sourcePort": "audio-out",
      "targetId": "filter-1",
      "targetPort": "audio-in"
    },
    {
      "id": "conn-2",
      "sourceId": "filter-1",
      "sourcePort": "audio-out",
      "targetId": "master-1",
      "targetPort": "audio-in"
    }
  ]
}
```

---

### PatchCategory (NEW)

Enum/type for categorizing patches in the UI.

**Values**:
- `'user'` - User-created patches (mutable, stored in localStorage)
- `'factory'` - Pre-built example patches (read-only, from static files)

**Purpose**: Type-safe discriminator for UI rendering and permission checks.

**Usage**:
```typescript
type PatchCategory = 'user' | 'factory';

interface CategoryState {
  current: PatchCategory;
  userPatches: PatchMetadata[];
  factoryPatches: FactoryPatchMetadata[];
}
```

---

## Relationships

```
FactoryPatchMetadata
  └─ contains ──> PatchData (extended with description)
                     ├─ contains ──> ComponentData[] (existing)
                     └─ contains ──> Connection[] (existing)

LoadModal
  ├─ displays ──> User Patches (PatchMetadata from localStorage)
  └─ displays ──> Factory Patches (FactoryPatchMetadata from static files)
```

---

## State Management

### Factory Patch Loading State

**Lifecycle**:
1. **Initialization**: App starts, FactoryPatchLoader.loadAll() called
2. **Loading**: Async fetch of factory patch JSON files
3. **Validation**: Each patch validated against PatchData schema
4. **Ready**: Valid patches stored in memory, available to LoadModal
5. **Error**: Invalid patches skipped with console warning

**State Transitions**:
```
NOT_LOADED → LOADING → READY
            ↓
          ERROR (partial - some patches failed)
```

### LoadModal Category State

**State**:
- `currentCategory`: PatchCategory - Currently selected tab ('user' | 'factory')
- `userPatches`: PatchMetadata[] - Patches from localStorage
- `factoryPatches`: FactoryPatchMetadata[] - Patches from static files

**Transitions**:
- User clicks "My Patches" tab → currentCategory = 'user', display userPatches
- User clicks "Factory" tab → currentCategory = 'factory', display factoryPatches
- User selects patch → Trigger load via PatchManager (same for both categories)

---

## Validation Schema

### Factory Patch File Validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateFactoryPatch(data: unknown): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Patch data must be an object'] };
  }

  const patch = data as any;

  if (!patch.name || typeof patch.name !== 'string') {
    errors.push('Missing or invalid "name" field');
  }

  if (!patch.version || typeof patch.version !== 'string') {
    errors.push('Missing or invalid "version" field');
  }

  if (!Array.isArray(patch.components)) {
    errors.push('Missing or invalid "components" array');
  }

  if (!Array.isArray(patch.connections)) {
    errors.push('Missing or invalid "connections" array');
  }

  // Optional fields
  if (patch.description !== undefined && typeof patch.description !== 'string') {
    errors.push('Invalid "description" field (must be string if present)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Storage

### Factory Patches (Static Files)

**Location**: `/public/patches/factory/*.json`

**Access**: HTTP fetch via `/patches/factory/{filename}`

**Characteristics**:
- Read-only (no write/update/delete operations)
- Bundled with application
- Version controlled with source code
- Loaded once on application startup

**Example File Structure**:
```
public/
└── patches/
    └── factory/
        ├── basic-oscillator.json
        ├── bass-synth.json
        ├── pad-sound.json
        └── simple-lead.json
```

### User Patches (Existing)

**Location**: Browser localStorage

**Access**: PatchStorage.getAllPatches(), PatchStorage.savePatch(), etc.

**Characteristics**:
- Mutable (create, update, delete)
- Per-browser storage
- Not version controlled

---

## Cache Strategy

Factory patches are loaded once on app initialization and cached in memory for the session.

**Cache Key**: filename (unique identifier)

**Cache Invalidation**: Only on page refresh/reload (no runtime invalidation needed since files are static)

**Memory Footprint**: Approximately 50KB per patch × 5 patches = ~250KB (negligible)

---

## Migration Notes

No data migration required. Existing user patches in localStorage are unaffected. The `description` field is optional, so existing patches without descriptions continue to work.

**Backward Compatibility**:
- Patches without `description` field: Display name only
- Patches with `description` field: Display name + description

**Forward Compatibility**:
- Future patch format versions can extend PatchData further
- Version checking ensures compatibility
