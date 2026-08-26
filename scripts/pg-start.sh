#!/bin/sh
# Starts the local PGlite Postgres detached and waits for the port.
LOG="${1:-/tmp/intro-pg.log}"
PIDFILE=.data/pg.pid

if [ -f "$PIDFILE" ]; then
  kill "$(cat $PIDFILE)" 2>/dev/null
  sleep 2
  rm -f "$PIDFILE"
fi

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
