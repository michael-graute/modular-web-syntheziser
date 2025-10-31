# Research: Factory Patches

**Feature**: 003-factory-patches
**Date**: 2025-10-31
**Status**: Complete

## Research Questions

### 1. How to structure factory patch JSON files for discoverability?

**Decision**: Add optional `description` field to existing PatchData format

**Rationale**:
- Existing PatchData interface already has `name`, `version`, `created`, `modified` fields
- Adding optional `description` field maintains backward compatibility
- Descriptions should be 1-2 sentences explaining the sound (e.g., "A warm bass sound using a sawtooth oscillator and lowpass filter")
- Metadata stays with the patch data itself, no separate index file needed

**Alternatives Considered**:
- Separate manifest.json file listing all factory patches with metadata
  - **Rejected**: Adds maintenance burden (two files to update), risk of getting out of sync
- Filename-based conventions (e.g., `bass-synth.description.txt`)
  - **Rejected**: Splits related data across multiple files, complicates file management
- Extended metadata in separate `.meta.json` files
  - **Rejected**: Overhead of managing paired files, no clear benefit

**Implementation**:
```typescript
// Extend existing PatchData interface in src/core/types.ts
export interface PatchData {
  name: string;
  version: string;
  created: string;
  modified: string;
  description?: string;  // NEW - optional field for factory patches
  components: ComponentData[];
  connections: Connection[];
}
```

---

### 2. How to load factory patches from static files efficiently?

**Decision**: Fetch factory patches asynchronously on application startup using fetch API

**Rationale**:
- Vite automatically copies `/public` folder contents to build output
- Files in `/public/patches/factory/` are accessible via `/patches/factory/filename.json`
- Use `fetch('/patches/factory/manifest.json')` to get list of available patches
- Then fetch each patch JSON file as needed (or prefetch all on startup)
- Non-blocking async loading prevents UI freeze
- Handles 404 errors gracefully if folder or files missing

**Alternatives Considered**:
- Import statements (`import patchData from './patch.json'`)
  - **Rejected**: Requires hardcoding patch list in code, not extensible
- Dynamic import (`import()`) with glob patterns
  - **Rejected**: Vite's glob import requires build-time knowledge, less flexible
- Bundle all patches into JavaScript module
  - **Rejected**: Increases initial bundle size, no clear separation of concerns

**Implementation Pattern**:
```typescript
// FactoryPatchLoader.ts
async function loadFactoryPatches(): Promise<FactoryPatchMetadata[]> {
  try {
    // Option 1: Load from manifest
    const manifest = await fetch('/patches/factory/manifest.json');
    const patchFiles = await manifest.json();

    // Option 2: Try known filenames (no manifest)
    const knownPatches = [
      'basic-oscillator.json',
      'bass-synth.json',
      'pad-sound.json'
    ];

    const patches = await Promise.all(
      knownPatches.map(async (filename) => {
        try {
          const response = await fetch(`/patches/factory/${filename}`);
          if (!response.ok) return null;
          const data = await response.json();
          return { ...data, filename };
        } catch (err) {
          console.warn(`Failed to load factory patch: ${filename}`, err);
          return null;
        }
      })
    );

    return patches.filter(p => p !== null);
  } catch (error) {
    console.error('Failed to load factory patches:', error);
    return []; // Graceful degradation
  }
}
```

---

### 3. How to display factory patches separately from user patches in LoadModal?

**Decision**: Tabbed interface with "My Patches" and "Factory" tabs

**Rationale**:
- Clear visual separation between mutable user patches and read-only factory patches
- Familiar UI pattern (users understand tabs)
- Easy to implement with existing Modal infrastructure
- Allows different actions per category (e.g., no delete button for factory patches)
- Scales well if more categories added later

**Alternatives Considered**:
- Single list with visual badges/icons to distinguish types
  - **Rejected**: Less clear separation, harder to scan visually
- Dropdown selector to switch between categories
  - **Rejected**: Extra click required, less discoverable than tabs
- Side-by-side panels
  - **Rejected**: Modal width constraints make this cramped

**Implementation Pattern**:
```typescript
// LoadModal.ts - Add tab navigation
private createTabs(): HTMLDivElement {
  const tabs = document.createElement('div');
  tabs.className = 'modal-tabs';

  const myPatchesTab = this.createTab('My Patches', true);
  const factoryTab = this.createTab('Factory', false);

  myPatchesTab.addEventListener('click', () => this.switchToUserPatches());
  factoryTab.addEventListener('click', () => this.switchToFactoryPatches());

  tabs.appendChild(myPatchesTab);
  tabs.appendChild(factoryTab);

  return tabs;
}

private switchToFactoryPatches(): void {
  this.currentCategory = 'factory';
  this.refreshPatchList();
}
```

---

### 4. How to handle factory patch validation and error recovery?

**Decision**: Validate each patch on load, skip invalid patches with console warning

**Rationale**:
- One bad patch shouldn't break entire factory collection
- Console warnings help developers identify issues during development
- Users see only valid patches (seamless experience)
- Validation ensures patch conforms to PatchData schema

**Alternatives Considered**:
- Fail fast on first invalid patch
  - **Rejected**: All-or-nothing approach is brittle, poor user experience
- Show error message in UI for each invalid patch
  - **Rejected**: Clutters UI with developer concerns, confusing for users
- Silent failure (skip without logging)
  - **Rejected**: Makes debugging difficult for developers

**Validation Rules**:
```typescript
function isValidFactoryPatch(data: any): data is PatchData {
  return (
    typeof data.name === 'string' &&
    typeof data.version === 'string' &&
    Array.isArray(data.components) &&
    Array.isArray(data.connections) &&
    (data.description === undefined || typeof data.description === 'string')
  );
}
```

---

### 5. Best practices for versioning factory patches?

**Decision**: Use semantic versioning in patch files, version check for compatibility

**Rationale**:
- Patch format may evolve over time (new component types, parameter changes)
- Version field already exists in PatchData
- Can check version compatibility before loading
- Warn users if factory patch is too old/new for current app version

**Implementation**:
- Factory patches use format version (e.g., "1.0.0")
- Application tracks supported patch format version range
- On load, check if patch version is compatible
- If incompatible, skip with warning or attempt graceful degradation

**Compatibility Check**:
```typescript
function isCompatibleVersion(patchVersion: string, appVersion: string): boolean {
  const [patchMajor] = patchVersion.split('.').map(Number);
  const [appMajor] = appVersion.split('.').map(Number);

  // Major version must match (breaking changes)
  return patchMajor === appMajor;
}
```

---

## Summary of Decisions

| Question | Decision | Key Benefit |
|----------|----------|-------------|
| Metadata structure | Optional `description` field in PatchData | Simple, no extra files needed |
| Loading mechanism | Async fetch from `/public` folder | Non-blocking, graceful degradation |
| UI organization | Tabbed interface (My Patches / Factory) | Clear separation, familiar pattern |
| Error handling | Skip invalid patches with warning | Resilient, good DX and UX |
| Versioning | Semantic versioning with compatibility check | Future-proof, handles evolution |

## Open Questions

None. All research questions resolved with clear implementation paths.
