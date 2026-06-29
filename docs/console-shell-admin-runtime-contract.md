# Admin Console Shell Runtime Contract

The `/admin` page currently renders through `ManagerConsoleShell`.

`ManagerConsoleShell` renders the canonical console shell component internally, so the runtime path is:

```text
/admin page -> ManagerConsoleShell -> canonical console shell
```

The console shell contract guard should validate this runtime path instead of requiring every route to import the canonical shell directly.

Local repair command is documented in the assistant response if the connector blocks direct script changes.
