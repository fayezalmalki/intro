#!/bin/sh
# Starts the local PGlite Postgres detached and waits for the port.
LOG="${1:-/tmp/intro-pg.log}"
PIDFILE=.data/pg.pid

# The pidfile is the happy path; pg-stop.mjs also finds an orphan whose
# pidfile was deleted, which is exactly what a `rm -rf .data` does.
if [ -f "$PIDFILE" ]; then
  kill "$(cat $PIDFILE)" 2>/dev/null
  rm -f "$PIDFILE"
fi
node scripts/pg-stop.mjs
sleep 2

mkdir -p .data
setsid nohup node scripts/db-local.mjs > "$LOG" 2>&1 < /dev/null &
for i in $(seq 1 30); do
  sleep 1
  if node -e "const n=require('net'),s=n.connect(5432,'127.0.0.1');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; then
    echo "local postgres up after ${i}s"
    exit 0
  fi
done
echo "local postgres failed to start"
tail -10 "$LOG"
exit 1
