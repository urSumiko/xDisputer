# Server Repositories Boundary

Repositories own Supabase data access.

Rules:

- Keep SQL/table access here.
- Return typed domain rows or typed persistence errors.
- Do not parse raw HTTP requests here.
- Do not import React components here.
