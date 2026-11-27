#!/usr/bin/env bash
# Creates the ImprovMX SMTP login intro.sa sends from, and stores it on the
# Worker — the password is generated here and never printed.
# Prerequisite: `improvmx auth login` (your ImprovMX API key).
set -euo pipefail
cd "$(dirname "$0")/.."
IMPROVMX="${IMPROVMX:-$HOME/.local/bin/improvmx}"
# Usage: setup-improvmx-smtp.sh [user] [domain] [secret prefix]
#   default:  noreply intro.sa IMPROVMX_SMTP   (sign-in and app mail)
#   outreach: outreach reach.intro.sa OUTREACH_SMTP   (sending through intro)
USER_LOCAL="${1:-noreply}"
DOMAIN="${2:-intro.sa}"
PREFIX="${3:-IMPROVMX_SMTP}"

"$IMPROVMX" account >/dev/null || { echo "Run: improvmx auth login"; exit 1; }
PW="$(openssl rand -base64 32 | tr -d '/+=\n' | cut -c1-32)"

if "$IMPROVMX" smtp list "$DOMAIN" --json | grep -q "\"$USER_LOCAL@$DOMAIN\"\|\"username\": *\"$USER_LOCAL\""; then
  echo "An SMTP login $USER_LOCAL@$DOMAIN already exists; replacing it so the Worker and ImprovMX match."
  "$IMPROVMX" smtp delete "$DOMAIN" "$USER_LOCAL" >/dev/null
fi
"$IMPROVMX" smtp add "$DOMAIN" "$USER_LOCAL" "$PW" >/dev/null
echo "✓ ImprovMX SMTP login created: $USER_LOCAL@$DOMAIN"

npx cf workers secrets update "${PREFIX}_USER" --text "$USER_LOCAL@$DOMAIN" --type secret_text >/dev/null
npx cf workers secrets update "${PREFIX}_PASSWORD" --text "$PW" --type secret_text >/dev/null
unset PW
echo "✓ Worker secrets ${PREFIX}_USER and ${PREFIX}_PASSWORD set"
