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

Type `/restart` in a Claude Code session that runs inside a herdr pane.

## How it works

A mod cannot end its own process or take over the terminal, so it asks herdr to do it:

1. `/restart` sets a flag and queues the built-in `/exit`.
2. On `session.end` (not for `/clear` or resume), `hooks/relaunch.sh` finds the
   `claude` process, rebuilds its command line with `--resume <session id>`, and
   starts a detached helper.
3. The helper waits for `claude` to exit (at most 30 s), then runs
   `herdr pane run $HERDR_PANE_ID "<command>"`, which types it into the pane's shell.

The original launch flags (for example `--dangerously-skip-permissions`) are kept.

## Limits

- Needs herdr (`HERDR_PANE_ID` set). Elsewhere `/restart` says so and does nothing.
- Environment set by a wrapper such as `ocx` is not restored; the relaunch runs plain `claude`.
- A bare `--resume` with no id in the original command line is misparsed.
- Needs `bash`, `setsid`, `nohup` and `/proc` (Linux).

## License

MIT
