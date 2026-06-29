# Auto Commit Recovery Report Workflow

This repository includes `scripts/auto-commit-report.mjs` for auditable local commits from Codespace.

## What it does

The script detects local changed files, ignores build/cache artifacts, creates a Markdown recovery report, stages the changed files plus the report, and creates a Git commit.

Each report includes:

- user intent
- summary of what changed
- problem or wrong behavior being fixed
- changed file list
- diff stat
- old version preview from `HEAD`
- latest local version preview
- recovery command reference

Reports are saved under:

`docs/change-reports/`

## Preview report only

```bash
node scripts/auto-commit-report.mjs --dry-run --intent "Describe user request" --summary "Describe what changed" --problem "Describe wrong behavior"
```

## Create local commit with report

```bash
node scripts/auto-commit-report.mjs --intent "Describe user request" --summary "Describe what changed" --problem "Describe wrong behavior" --message "Describe commit"
```

## Create commit with guards/typecheck first

```bash
node scripts/auto-commit-report.mjs --verify --intent "Describe user request" --summary "Describe what changed" --problem "Describe wrong behavior" --message "Describe commit"
```

## Create commit and publish to GitHub

```bash
node scripts/auto-commit-report.mjs --verify --push --intent "Describe user request" --summary "Describe what changed" --problem "Describe wrong behavior" --message "Describe commit"
```

## Recommended Codespace workflow

1. Make code changes.
2. Run the preview command to create and inspect a report.
3. Run the verified commit command.
4. Run `npm run codespace:sync:verify` before opening the preview.
5. Restart `npm run codespace:dev` if the browser still shows stale chunks.

## Safety behavior

- The script does not include `.next/`, `.next-quarantine/`, `.codespace-sync/`, `node_modules/`, or `tsconfig.tsbuildinfo`.
- The script does not automatically invent user intent. Pass `--intent`, `--summary`, and `--problem` for high-quality reports.
- The script stores previews, not full unlimited file dumps, to keep reports readable.
