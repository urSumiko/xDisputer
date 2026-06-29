# Server Boundary

This folder is the modernization destination for backend code.

## Target layers

- `contracts` - schemas, DTOs, and typed result shapes
- `http` - request/response mapping helpers
- `policies` - access and account-scope decisions
- `repositories` - Supabase data access
- `services` - business use cases
- `auth` - session and account helpers

## Route standard

```text
parse request -> validate -> authorize -> call service -> map result -> return response
```

Route handlers should become thin controllers over time. Existing route behavior should move here route by route, not by full rewrite.
