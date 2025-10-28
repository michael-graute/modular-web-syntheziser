# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: TypeScript (latest), Node.js (latest LTS)
**Primary Dependencies**:
- Backend: NestJS (latest), Drizzle ORM or TypeORM, PostgreSQL
- Frontend: Angular (latest), Bootstrap (latest), ag-Grid
**Storage**: PostgreSQL (latest) with multi-tenancy via `company_id` foreign keys
**Testing**: Jest (backend), Jasmine/Karma (frontend), Playwright (E2E - if required)
**Target Platform**: Kubernetes (production), Docker Compose (local development)
**Project Type**: Web application (monorepo with backend/ and frontend/ directories)
**Performance Goals**: Handle moderate frontend load + high automated process load (data imports, external API calls)
**Constraints**:
- Small team (1-2 developers)
- Multi-language support (EN, DE, HU+)
- Multi-tenancy (company-level data isolation)
- Audit trail for all data modifications
**Scale/Scope**: Sea freight container management, 6 core workflows (data import, release approvals, drop-off/pick-up, street-turn, export)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0.0

Verify feature compliance with VisiMatch Constitution principles:

- [ ] **I. Rapid Prototyping with Quality Foundation**: Does feature enable single-developer context switching? Are types self-documenting? Are automated quality gates included?
- [ ] **II. Monorepo Strategy with Modular Architecture**: Is feature organized by functionality (not layers)? Is module independently testable?
- [ ] **III. Multi-Tenancy is Non-Negotiable**: Does every data model/query/endpoint enforce company-level isolation? Is `company_id` included in relevant models?
- [ ] **IV. Observability and Audit Trail**: Are all data modifications logged with user ID, timestamp, and company context? Is Sentry integration included?
- [ ] **V. Progressive Enhancement for UX Complexity**: Does UI match user type (Request/Approval UI = mobile-responsive wizard, Admin UI = desktop ag-Grid style)?
- [ ] **VI. Deferred DevOps Complexity**: Does feature work in Docker Compose locally? Does it support multistage deployment (dev/test/prod)?
- [ ] **VII. Security by Default**: Are sensitive configs in `.env`/secrets? Do JWT tokens include company context? Is HTTPS enforced?

If any principle is violated, document in **Complexity Tracking** section below.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── [feature-name]/              # Feature-based organization
│   │   ├── entities/                 # Database models with company_id
│   │   ├── dto/                      # Data transfer objects
│   │   ├── services/                 # Business logic
│   │   ├── controllers/              # API endpoints
│   │   └── [feature-name].module.ts  # NestJS module
│   ├── common/                       # Shared utilities
│   │   ├── guards/                   # Auth guards (multi-tenancy)
│   │   ├── interceptors/             # Logging, error handling
│   │   └── types/                    # Shared types
│   └── main.ts
├── tests/
│   ├── contract/                     # API contract tests (if required)
│   ├── integration/                  # User journey tests (if required)
│   └── unit/                         # Business logic tests (if required)
└── package.json

frontend/
├── src/
│   ├── app/
│   │   ├── [feature-name]/           # Feature-based organization
│   │   │   ├── components/           # Feature components
│   │   │   ├── services/             # API clients
│   │   │   ├── models/               # Frontend types
│   │   │   └── [feature-name].module.ts
│   │   ├── request-ui/               # Customer-facing wizard UI
│   │   ├── admin-ui/                 # Power user ag-Grid UI
│   │   ├── shared/                   # Shared components
│   │   └── core/                     # Auth, guards, interceptors
│   ├── environments/
│   └── main.ts
├── tests/
│   └── e2e/                          # Playwright tests (if required)
└── package.json

shared/
└── contracts/                        # Shared API types (TypeScript)

docker-compose.yml                    # Local development (Traefik + services)
.env.example                          # Environment template
```

**Structure Decision**: Web application monorepo with feature-based organization. Backend (NestJS) and frontend (Angular) are independently buildable. Shared contracts ensure type safety across API boundaries.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
