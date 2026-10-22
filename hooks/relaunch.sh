#!/bin/bash
# $1 herdr pane, $2 session id. Finds the claude process above this one, rebuilds its
# command line with --resume, and, detached, waits for it to exit and types the command
# into the herdr pane's shell.
# shortcut: needs herdr; a bare `--resume` with no id is misparsed, upgrade if that launch form is used.
pid=$PPID
while [ "$pid" -gt 1 ] && [ "$(cat /proc/$pid/comm)" != claude ]; do pid=$(awk '{print $4}' /proc/$pid/stat); done
[ "$pid" -gt 1 ] || exit 1
mapfile -d '' args </proc/$pid/cmdline
keep=(); skip=0
for a in "${args[@]}"; do
  if ((skip)); then skip=0; continue; fi
  case $a in --resume|-r) skip=1 ;; --continue|-c) ;; *) keep+=("$a") ;; esac
done
cmd=$(printf '%q ' "${keep[@]}" --resume "$2")
# Waits at most 30 s, so a claude that never exits leaves no helper behind.
setsid nohup bash -c 'for _ in $(seq 150); do kill -0 $0 2>/dev/null || { sleep 0.3; exec herdr pane run "$1" "$2"; }; sleep 0.2; done' "$pid" "$1" "$cmd" </dev/null >/dev/null 2>&1 &
