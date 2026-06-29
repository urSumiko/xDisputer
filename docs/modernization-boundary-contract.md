# xDisputer Modernization Boundary Contract

## Purpose

This contract converts the 10x modernization canvas into enforceable repo boundaries. The repo keeps its current product behavior while gaining a modular monolith structure that can absorb Tailwind, shadcn/ui, Zod, TanStack Query, and service-layer backend work without a risky rewrite.

## Active direction

- Keep Next.js App Router, React 19, TypeScript, Supabase, DOCX, PDF, packets, and dispute generation.
- Add standards beside the current app before moving behavior.
- Prefer server components by default.
- Keep client components only for real interactivity.
- Move backend work into server contracts, services, repositories, policies, and HTTP helpers.
- Move frontend ownership into feature slices.
- Reduce global CSS only after each surface has a replacement owner.

## Boundary rules

### Routes

Route handlers should eventually follow:

```text
parse request -> validate -> authorize -> call service -> map result -> return response
```

Current patches may add helper modules before changing route behavior.

### Services

Services own business use cases and return typed service results. They should not parse raw HTTP requests.

### Repositories

Repositories own Supabase reads/writes. React components should not call repositories directly.

### Policies

Policies own account scope, role checks, and business access decisions. Route handlers should call policies instead of duplicating permission rules.

### Features

Feature folders own product-domain UI and client behavior. Shared UI belongs in controlled shared primitives only when truly reused.

### Styling

New global CSS files are frozen unless a tracker entry explains why they are needed. Prefer existing design tokens and frontend-control identities until Tailwind/shadcn are introduced.

## First feature ownership map

| Feature | Future owner |
| --- | --- |
| Sign in and session setup | `src/features/auth` |
| Master/manager/client accounts | `src/features/accounts` |
| Template manifests and selection | `src/features/templates` |
| Source data collection and validation | `src/features/source-data` |
| Document generation workflow | `src/features/generation` |
| Output review and final packets | `src/features/outputs` |
| Supporting documents and evidence | `src/features/evidence` |
| Notification surfaces | `src/features/notifications` |
| Master administration and monitoring | `src/features/admin` |

## Guard expectations

The modernization guard must confirm:

- tracker exists
- boundary contract exists
- feature root exists
- server root exists
- service result contract exists
- HTTP response helper exists
- readiness endpoint exists

## Deferred work

Dependency changes are intentionally deferred until the lockfile is repaired. The first dependency after repair should be Zod because the canvas requires runtime validation at external boundaries.
