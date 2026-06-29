# Visible Change Test Playbook

## Standing rule

For UI-facing repo changes, always run the website locally or in Codespaces and verify the visible change in the browser before calling the change complete.

## Master Console ⇄ UI Workspace visible test

### 1. Sync and install

```bash
git checkout main
git pull origin main
npm ci
```

### 2. Run focused guards first

```bash
npm run master-ui-workspace:guard
npm run console-shell:guard
npm run typecheck
```

### 3. Start the website

Local machine:

```bash
npm run dev
```

GitHub Codespaces:

```bash
npm run codespace:dev
```

### 4. Open the visible routes

```text
http://localhost:3000/master
http://localhost:3000/master/ui-workspace
```

In Codespaces, open the forwarded port 3000 URL and then visit:

```text
/master
/master/ui-workspace
```

### 5. Visible checks

- Log in as a master account.
- On `/master`, confirm the sidebar bottom switch shows `Master Console ⇄ UI Workspace`.
- Click the switch and confirm it opens `/master/ui-workspace`.
- On `/master/ui-workspace`, confirm the switch target returns to `Master Console`.
- Confirm the existing UI workspace still shows the mode strip, preview canvas, and inspector panel.

### 6. Full verification before pushing further UI work

```bash
npm run build
npm run xdisputer:guard
```

## Expected result

The master account has a clear visible bottom switch labeled `Master Console ⇄ UI Workspace`, and switching does not break the existing master UI workspace editor.
