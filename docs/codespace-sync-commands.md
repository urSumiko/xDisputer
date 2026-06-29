# Codespace Sync Commands

Use these commands to keep the Codespace preview aligned with GitHub `main`.

## Pull latest repo code into Codespace

`npm run codespace:sync`

## Pull latest repo code and run verification

`npm run codespace:sync:verify`

## Keep watching GitHub for updates

`npm run codespace:sync:watch`

## Publish already committed Codespace changes to GitHub

`npm run codespace:publish`

## Recommended preview workflow

Terminal 1: `npm run codespace:sync:watch`

Terminal 2: `npm run codespace:dev`

When a sync happens, restart the dev server if the preview still shows old CSS or old route chunks.

## Safety behavior

The sync bridge checks the current branch, checks local file status, fetches `origin/main`, fast-forwards when possible, and records sync state under `.codespace-sync/`.
