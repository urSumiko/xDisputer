# Server Services Boundary

Services own business use cases.

Rules:

- Services receive validated input and normalized actor context.
- Services call repositories and policies.
- Services return `ServiceResult<T>`.
- Services do not format HTTP responses.
