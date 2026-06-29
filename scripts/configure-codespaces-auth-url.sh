#!/usr/bin/env bash
set -euo pipefail

SITE_URL="https://verbose-space-parakeet-qxjwv9vw5j9c9g9v-3000.app.github.dev"
CALLBACK_URL="${SITE_URL}/auth/callback"
ENV_FILE=".env.local"

echo "=== Configure local app URL ==="

touch "$ENV_FILE"

python3 <<PY
from pathlib import Path

env_path = Path("$ENV_FILE")
site_url = "$SITE_URL"

text = env_path.read_text() if env_path.exists() else ""
lines = []
seen = False

for line in text.splitlines():
    if line.startswith("NEXT_PUBLIC_SITE_URL="):
        lines.append(f"NEXT_PUBLIC_SITE_URL={site_url}")
        seen = True
    else:
        lines.append(line)

if not seen:
    lines.append(f"NEXT_PUBLIC_SITE_URL={site_url}")

env_path.write_text("\\n".join(lines).strip() + "\\n")
PY

echo ""
echo "✅ .env.local updated:"
grep "NEXT_PUBLIC_SITE_URL" "$ENV_FILE"

echo ""
echo "=== Supabase Dashboard setting required ==="
echo "Go to:"
echo "Supabase Dashboard → Authentication → URL Configuration"
echo ""
echo "Set Site URL to:"
echo "$SITE_URL"
echo ""
echo "Add Redirect URL:"
echo "$CALLBACK_URL"
echo ""
echo "Recommended while developing:"
echo "Supabase Dashboard → Authentication → Providers → Email → Confirm email = OFF"
echo ""

echo "=== Restarting dev server ==="
pkill -f "next dev" 2>/dev/null || true
npm run dev -- --hostname 0.0.0.0 --port 3000
