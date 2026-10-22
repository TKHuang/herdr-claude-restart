import type { Register } from 'claude-code'

let isRestarting = false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'restart',
      description: 'Exit and relaunch Claude on the same session (applies a new version)',
    })

    return next(e)
  })

  on('command.run', { command: 'restart' }, async $ => {
    if (!(await $.env.get('HERDR_PANE_ID'))) {
      return { text: '/restart needs herdr: not inside a herdr pane.' }
    }
    isRestarting = true
    // Queued run of /exit once this command ends; the flag lapses if it never exits.
    $.clock.after(200, () => void $.command.run({ command: 'exit' }))
    $.clock.after(10_000, () => {
      isRestarting = false
    })

    return { text: 'Restarting…' }
  })

  on('session.end', async ($, e, next) => {
    const pane = await $.env.get('HERDR_PANE_ID')
    // clear and resume keep the process alive: no relaunch for them.
    if (isRestarting && pane && e.reason !== 'clear' && e.reason !== 'resume') {
      await $.process.run(['bash', `${$.plugin.root}/hooks/relaunch.sh`, pane, e.resume.id])
    }

    return next(e)
  })
}
