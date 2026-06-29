# Visible Change Test Command Contract

## Preference

For website-visible changes, provide one combined terminal command block that pulls latest code, installs dependencies, runs guards, checks TypeScript, builds, and starts the dev server.

## Full command

```bash
git checkout main && \
git pull origin main && \
npm ci && \
npm run master-ui-workspace:guard && \
npm run console-shell:guard && \
npm run typecheck && \
npm run build && \
npm run codespace:dev
```

## Routes to review

```text
/master
/master/ui-workspace
```

## Expected visible result

The bottom sidebar switch should display:

```text
Master Console ⇄ UI Workspace
```

It should navigate between:

```text
/master
/master/ui-workspace
```

## Faster loop after npm install

```bash
git checkout main && \
git pull origin main && \
npm run master-ui-workspace:guard && \
npm run console-shell:guard && \
npm run typecheck && \
npm run codespace:dev
```
