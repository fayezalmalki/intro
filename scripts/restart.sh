#!/bin/sh
# Restart the local server. Finds the running server by scanning /proc for the
# next-server process specifically, so it never kills the shell that runs it
# (which a `pkill -f next` does).
LOG="${1:-/tmp/intro-server.log}"

find_pid() {
  node -e "
const fs = require('fs');
for (const d of fs.readdirSync('/proc')) {
  if (!/^[0-9]+\$/.test(d)) continue;
  let cmd = '';
  try { cmd = fs.readFileSync('/proc/' + d + '/cmdline', 'utf8').replace(/\0/g, ' '); } catch { continue; }
  if (/^next-server/.test(cmd.trim())) { console.log(d); break; }
}"
}

pid=$(find_pid)
if [ -n "$pid" ]; then
  kill "$pid" 2>/dev/null
  for i in $(seq 1 10); do sleep 1; [ -z "$(find_pid)" ] && break; done
  [ -n "$(find_pid)" ] && kill -9 "$(find_pid)" 2>/dev/null
fi

rm -rf .data
setsid nohup npm run start > "$LOG" 2>&1 < /dev/null &
for i in $(seq 1 40); do
  sleep 1
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:3000/ 2>/dev/null)" = "200" ]; then
    echo "server up after ${i}s (pid $(find_pid))"
    exit 0
  fi
done
echo "server failed to start"; tail -20 "$LOG"; exit 1
