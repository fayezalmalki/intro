#!/usr/bin/env bash
# Stores the Google OAuth client for "Continue with Google" on the Worker and
# checks Google accepts it. The values are read without echo and never printed.
# Create the client first: Google Cloud Console → APIs & Services → Credentials
# → Create OAuth client ID → Web application, with
#   Authorized JavaScript origin: https://intro.sa
#   Authorized redirect URI:      https://intro.sa/api/auth/callback/google
set -euo pipefail
cd "$(dirname "$0")/.."

# Without a terminal to type in (e.g. run from Claude Code with "!"), take each
# value from the clipboard instead:  setup-google-oauth.sh id | secret | check
MODE="${1:-prompt}"
if [[ "$MODE" == "id" ]]; then
  CID="$(pbpaste | tr -d '[:space:]')"
  [[ "$CID" == *.apps.googleusercontent.com ]] || { echo "✗ The clipboard doesn't hold a client ID (…apps.googleusercontent.com). Copy it and rerun."; exit 1; }
  npx cf workers secrets update GOOGLE_CLIENT_ID --text "$CID" --type secret_text >/dev/null
  echo "✓ GOOGLE_CLIENT_ID set (${CID:0:6}…). Now copy the Client secret and run: setup-google-oauth.sh secret"; exit 0
elif [[ "$MODE" == "secret" ]]; then
  CSECRET="$(pbpaste | tr -d '[:space:]')"
  [[ -n "$CSECRET" && "$CSECRET" != *.apps.googleusercontent.com ]] || { echo "✗ The clipboard doesn't hold the client secret. Copy it and rerun."; exit 1; }
  npx cf workers secrets update GOOGLE_CLIENT_SECRET --text "$CSECRET" --type secret_text >/dev/null
  unset CSECRET; printf '' | pbcopy
  echo "✓ GOOGLE_CLIENT_SECRET set (clipboard cleared). Checking with Google…"
elif [[ "$MODE" == "check" ]]; then
  :
else
  read -r -p "Google OAuth Client ID: " CID
  read -r -s -p "Google OAuth Client secret (hidden): " CSECRET; echo
  [[ "$CID" == *.apps.googleusercontent.com ]] || { echo "✗ That doesn't look like a client ID (…apps.googleusercontent.com)"; exit 1; }
  [[ -n "$CSECRET" ]] || { echo "✗ Empty secret"; exit 1; }
  npx cf workers secrets update GOOGLE_CLIENT_ID --text "$CID" --type secret_text >/dev/null
  npx cf workers secrets update GOOGLE_CLIENT_SECRET --text "$CSECRET" --type secret_text >/dev/null
  unset CSECRET
  echo "✓ Worker secrets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set"
fi

sleep 5
URL=$(curl -s -X POST https://intro.sa/api/auth/sign-in/social -H "content-type: application/json" -H "origin: https://intro.sa" \
  -d '{"provider":"google","callbackURL":"/resume"}' | python3 -c "import sys,json;print(json.load(sys.stdin).get('url',''))" 2>/dev/null || true)
if [[ -z "$URL" ]]; then echo "✗ intro.sa didn't return a Google sign-in link yet — wait a minute and rerun the check: curl -s -X POST https://intro.sa/api/auth/sign-in/social …"; exit 1; fi
PAGE=$(curl -s -L "$URL")
if grep -q "redirect_uri_mismatch" <<<"$PAGE"; then echo "✗ Google rejected the redirect URI — add https://intro.sa/api/auth/callback/google to the client"; exit 1; fi
if grep -qE "invalid_client|deleted_client|disabled_client" <<<"$PAGE"; then echo "✗ Google doesn't recognise this client ID"; exit 1; fi
echo "✓ Google accepts the client and redirect. 'Continue with Google' is live on https://intro.sa/login"
