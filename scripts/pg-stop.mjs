/**
 * Stops the local PGlite server.
 *
 * Matches on argv[1] rather than substring-searching the whole command line:
 * a pattern broad enough to find the server also matches the shell that is
 * doing the searching, which kills the caller instead. The pidfile is the
 * happy path; this is what makes deleting it recoverable.
 */
import fs from "node:fs";

const targets = [];
for (const entry of fs.readdirSync("/proc")) {
  if (!/^\d+$/.test(entry)) continue;
  const pid = Number(entry);
  if (pid === process.pid) continue;
  let argv;
  try {
    argv = fs.readFileSync(`/proc/${entry}/cmdline`, "utf8").split("\0").filter(Boolean);
  } catch {
    continue;
  }
  if (argv.length >= 2 && argv[1].endsWith("scripts/db-local.mjs")) targets.push(pid);
}

for (const pid of targets) {
  try {
    process.kill(pid);
    console.log(`stopped local postgres (pid ${pid})`);
  } catch {
    /* already gone */
  }
}
if (targets.length === 0) console.log("no local postgres running");
