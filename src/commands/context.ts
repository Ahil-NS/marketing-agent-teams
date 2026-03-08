import {Command, Flags} from '@oclif/core'
import {execSync} from 'node:child_process'

import {ContextManager} from '../lib/context/context-manager.js'

export default class Context extends Command {
  static override description = 'Manage product marketing context'

  static override flags = {
    init: Flags.boolean({
      description: 'Run the context discovery agent to create product marketing context',
    }),
    show: Flags.boolean({
      description: 'Display the current product marketing context',
    }),
    edit: Flags.boolean({
      description: 'Open the context file in your default editor',
    }),
  }

  static override args = {}

  async run(): Promise<void> {
    const {flags} = await this.parse(Context)
    const projectRoot = process.cwd()
    const contextManager = new ContextManager(projectRoot)

    if (flags.init) {
      await this.initContext(contextManager)
      return
    }

    if (flags.show) {
      await this.showContext(contextManager)
      return
    }

    if (flags.edit) {
      await this.editContext(contextManager)
      return
    }

    // Default: show if exists, otherwise suggest init
    const exists = await contextManager.exists()
    if (exists) {
      await this.showContext(contextManager)
    } else {
      this.log('No product marketing context found.')
      this.log('Run `mat context --init` to create one via the discovery agent.')
    }
  }

  private async initContext(contextManager: ContextManager): Promise<void> {
    const exists = await contextManager.exists()
    if (exists) {
      this.log('Product marketing context already exists.')
      this.log(`File: ${contextManager.getContextPath()}`)
      this.log('Use `mat context --edit` to modify, or delete the file and re-run --init.')
      return
    }

    this.log('Starting product marketing context discovery...')
    this.log('The context agent will ask you about your product, audience, and brand.')
    this.log('')

    try {
      // Run the context agent via claude -p
      execSync(
        `claude -p "Run the product marketing context discovery process. Ask me questions about my product, audience, brand voice, competitors, and marketing goals. Write the final context to .mat/context/product-marketing-context.md" --system-prompt "$(cat src/agents/intelligence/product-marketing-context/SKILL.md)" --allowedTools "Read,Write,WebSearch,WebFetch"`,
        {stdio: 'inherit', cwd: process.cwd()},
      )

      const created = await contextManager.exists()
      if (created) {
        this.log('')
        this.log('Product marketing context created successfully!')
        this.log(`File: ${contextManager.getContextPath()}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.error(`Context discovery failed: ${message}`)
    }
  }

  private async showContext(contextManager: ContextManager): Promise<void> {
    const content = await contextManager.getContext()
    if (!content) {
      this.log('No product marketing context found.')
      this.log('Run `mat context --init` to create one.')
      return
    }

    this.log(content)
  }

  private async editContext(contextManager: ContextManager): Promise<void> {
    const exists = await contextManager.exists()
    if (!exists) {
      this.log('No product marketing context found. Run `mat context --init` first.')
      return
    }

    const editor = process.env.EDITOR ?? process.env.VISUAL ?? 'vi'
    const contextPath = contextManager.getContextPath()

    try {
      execSync(`${editor} "${contextPath}"`, {stdio: 'inherit'})
      this.log('Context file updated.')
    } catch {
      this.log(`Open manually: ${contextPath}`)
    }
  }
}
