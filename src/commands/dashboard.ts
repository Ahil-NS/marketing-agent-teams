import {Command, Flags} from '@oclif/core'

export default class Dashboard extends Command {
  static override description = 'Start the web dashboard for visual pipeline management'

  static override flags = {
    port: Flags.integer({
      char: 'p',
      description: 'Port number for the dashboard server',
      default: 3847,
    }),
    'no-open': Flags.boolean({
      description: 'Do not open browser automatically',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Dashboard)
    const projectRoot = process.cwd()

    this.log('Starting MAT Dashboard...')

    try {
      const {startDashboard} = await import('../lib/dashboard/server.js')
      const {port, close} = await startDashboard({projectRoot, port: flags.port})

      const url = `http://localhost:${port}`
      this.log(`Dashboard running at ${url}`)

      if (!flags['no-open']) {
        try {
          const {exec} = await import('node:child_process')
          const openCmd = process.platform === 'darwin'
            ? `open "${url}"`
            : process.platform === 'win32'
              ? `start "${url}"`
              : `xdg-open "${url}"`
          exec(openCmd)
        } catch {
          // Browser open is best-effort
        }
      }

      this.log('Press Ctrl+C to stop the dashboard.')

      // Keep the process running
      await new Promise<void>((resolve) => {
        process.on('SIGINT', () => {
          this.log('\nStopping dashboard...')
          close()
          resolve()
        })
        process.on('SIGTERM', () => {
          close()
          resolve()
        })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.error(`Dashboard failed to start: ${message}`)
    }
  }
}
