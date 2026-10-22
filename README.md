# herdr-claude-restart

A Claude Code mod that adds `/restart`: it exits Claude Code and starts it again
on the same session, in the same [herdr](https://herdr.dev) pane. Use it after
"Update installed · Restart to update" instead of quitting, relaunching and
picking the session in `/resume`.

## Install

```
/plugin install herdr-claude-restart --marketplace TKHuang/herdr-claude-restart
```

Or from a local clone, for one run: `claude --plugin-dir /path/to/herdr-claude-restart`.

## Use

Type `/restart` in a Claude Code session that runs inside a herdr pane. You can type it while
the agent works: Claude restarts only when the agent is done.

- `/restart` waits until the agent ends its turn (queued messages and an open question dialog
  included) and no background work (background shells, background subagents, monitors,
  scheduled `/loop` wakeups) is running.
- `/restart now` waits for the current turn only. Claude's own exit prompt then asks you to stop
  the background work.
- `/restart cancel` stops a waiting restart.

## How it works

A mod cannot end its own process or take over the terminal, so it asks herdr to do it:

1. `/restart` marks a restart as pending. Each `Stop` hook reports the background work still
   running. A one-second timer runs the built-in `/exit` once the turn is over and no background
   work is left.
2. On `session.end` (not for `/clear` or resume), `hooks/relaunch.sh` finds the
   `claude` process, rebuilds its command line with `--resume <session id>`, and
   starts a detached helper.
3. The helper waits for `claude` to exit (at most 30 s), then runs
   `herdr pane run $HERDR_PANE_ID "<command>"`, which types it into the pane's shell.

The original launch flags (for example `--dangerously-skip-permissions`) are kept.

## Limits

- Needs herdr (`HERDR_ENV` is `1` and `HERDR_PANE_ID` set). Elsewhere `/restart` says so and does nothing.
- Environment set by a wrapper such as `ocx` is not restored; the relaunch runs plain `claude`.
- A bare `--resume` with no id in the original command line is misparsed.
- Needs `bash`, `setsid`, `nohup` and `/proc` (Linux).
- If you interrupt the agent (Esc) while a restart waits, Claude refuses commands from mods until
  you type again, so the restart is cancelled with a notice. Type `/restart` again.
- A recurring `/loop` never ends, so `/restart` waits for it forever: use `/restart now`.
- The background list comes from the last `Stop`. If background work ends without waking the
  agent, `/restart` typed while idle can wait for work that is already done: use `/restart now`.

## License

MIT
