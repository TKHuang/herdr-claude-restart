import type { EngineInterface, Register } from 'claude-code'

// pending: a restart waits for the agent to settle. force: do not wait for background work.
// isExiting: the /exit is ours, so session.end relaunches (a manual /exit never does).
let pending = false
let force = false
let isExiting = false
let isBusy = false
let isEnded = false
// Background work seen at the last Stop; the only place the engine reports it.
// shortcut: stale when /restart is typed idle and work ended without waking a turn, upgrade if it matters.
let background: string[] = []

const HELP = 'Run /restart now to restart without waiting, /restart cancel to stop waiting.'

// Runs from the session's timer, never from a turn's hook: an interrupted turn aborts what its hooks start.
function settle($: EngineInterface): void {
  if (!pending || isExiting || isBusy || (!force && background.length)) return
  isExiting = true
  pending = false
  // Queued run of /exit: it waits for queued messages and an open question to finish too.
  // The engine refuses it after the person interrupts the agent (Esc) until they type again.
  $.command.run({ command: 'exit' }).then(
    // Resolves just before session.end on a real exit; a session still alive 30 s on stayed
    // (Stay at the exit prompt), so a later manual /exit must not relaunch.
    // shortcut: a manual /exit within those 30 s still relaunches, upgrade if the engine reports Stay.
    () => {
      $.clock.after(30_000, () => {
        if (!isEnded) isExiting = false
      })
    },
    (err: unknown) => {
      isExiting = false
      $.ui.toast(`Restart cancelled: ${err instanceof Error ? err.message : String(err)}. Run /restart again.`)
    },
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'restart',
      description: 'Exit and relaunch Claude on the same session once the agent is done (applies a new version)',
      argumentHint: '[now|cancel]',
      // Runs at once, so the "queued" note shows while the agent works; only the /exit waits.
      immediate: true,
    })
    $.clock.every(1000, () => settle($))

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) isBusy = true

    return next(e)
  })

  // Fires for an interrupted turn too, which fires no Stop.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) isBusy = false

    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    background = [
      ...(e.background_tasks ?? []).map(t => `${t.type} ${t.command ?? t.description}`.slice(0, 60)),
      ...(e.session_crons ?? []).map(c => `schedule ${c.schedule}`),
    ]
    if (pending && !force && background.length) {
      $.ui.toast(`Restart waits for background work: ${background.join(', ')}. ${HELP}`)
    }

    return next(e)
  })

  on('command.run', { command: 'restart' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'cancel') {
      pending = force = false
      return { text: 'Restart cancelled.' }
    }
    if ((await $.env.get('HERDR_ENV')) !== '1' || !(await $.env.get('HERDR_PANE_ID'))) {
      return { text: '/restart needs herdr: not inside a herdr pane (HERDR_ENV is not 1).' }
    }
    if (pending && arg !== 'now') {
      return { text: `A restart is already waiting. ${HELP}` }
    }
    pending = true
    force = arg === 'now'
    if (force) {
      return { text: 'Restart queued: Claude relaunches once the current work ends. Background work is stopped.' }
    }
    const waits = !isBusy && background.length ? ` Waiting for: ${background.join(', ')}. ${HELP}` : ''

    return { text: `Restart queued: Claude relaunches when the agent and its background work are done.${waits}` }
  })

  on('session.end', async ($, e, next) => {
    isEnded = true
    const pane = await $.env.get('HERDR_PANE_ID')
    // clear and resume keep the process alive: no relaunch for them.
    if (isExiting && pane && e.reason !== 'clear' && e.reason !== 'resume') {
      await $.process.run(['bash', `${$.plugin.root}/hooks/relaunch.sh`, pane, e.resume.id])
    }
    pending = force = isExiting = false

    return next(e)
  })
}
