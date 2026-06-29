# Admin Feature Slice

Owns master administration, monitoring, audit, system health, and governance surfaces.

Modernization targets:

- keep master-only UI separated from general console shell
- centralize system-health data contracts
- route sensitive actions through server services and policies
- keep debug and telemetry surfaces out of production paths unless explicitly required
