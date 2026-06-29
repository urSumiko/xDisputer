# Server Auth Boundary

Owns session normalization, current account resolution, and auth-specific helpers.

Rules:

- Route handlers may call auth helpers.
- Services receive normalized actor context, not raw request/session objects.
- Components do not import from this folder.
