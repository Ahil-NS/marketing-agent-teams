import {Command, Flags} from '@oclif/core'
import {readFile} from 'node:fs/promises'
import {z} from 'zod'

import {createExecutor} from '../lib/agent-executor/executor-factory.js'
import type {ExecutionMode} from '../lib/agent-executor/executor-factory.js'
import {Orchestrator, StageRunner} from '../lib/orchestrator/index.js'
import type {OrchestratorConfig} from '../lib/orchestrator/index.js'
import {resolveWorkflow} from '../lib/orchestrator/workflow-resolver.js'
import {resolveAgentDir, loadSkill} from '../lib/agents/skill-loader.js'
import {executeAgent} from '../lib/agents/agent-executor.js'
import {MATError} from '../lib/utils/errors.js'

export default class Create extends Command {
  static override description = 'Create content with flexible workflow entry points'

  static override flags = {
    platforms: Flags.string({
      char: 'p',
      description: 'Target platforms (comma-separated)',
      multiple: true,
    }),
    'dry-run': Flags.boolean({
      description: 'Generate content without publishing',
      default: true,
    }),
    brief: Flags.string({
      description: 'Path to a brief file — skip research/strategy, start at creation',
    }),
    idea: Flags.string({
      description: 'Topic or idea string — run targeted research then create',
    }),
    agent: Flags.string({
      description: 'Run a single agent in isolation',
    }),
    optimize: Flags.boolean({
      description: 'Optimize metadata for an existing video (ECT workflow)',
      default: false,
    }),
    video: Flags.string({
      description: 'Path to existing video file',
      dependsOn: ['optimize'],
    }),
    topic: Flags.string({
      description: 'Video topic/subject for SEO optimization',
      dependsOn: ['optimize'],
    }),
    niche: Flags.string({
      description: 'Industry niche (e.g., "AI/SaaS", "fitness")',
      dependsOn: ['optimize'],
    }),
    audience: Flags.string({
      description: 'Target audience description',
      dependsOn: ['optimize'],
    }),
    'video-description': Flags.string({
      description: 'Detailed description of video content',
      dependsOn: ['optimize'],
    }),
    duration: Flags.string({
      description: 'Video duration (e.g., "30s", "60s")',
      dependsOn: ['optimize'],
    }),
    posts: Flags.integer({
      description: 'Number of content items per platform (1 = focused/fast, 3+ = full agent set)',
      default: 1,
    }),
    mode: Flags.string({
      description: 'Execution mode: native (claude -p), sdk, auto',
      options: ['native', 'sdk', 'auto'],
      default: 'auto',
    }),
    budget: Flags.integer({
      description: 'Budget limit in USD',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Create)

    // Single agent mode
    if (flags.agent) {
      await this.runSingleAgent(flags.agent, flags.mode as ExecutionMode)
      return
    }

    // ECT (optimize) workflow
    if (flags.optimize) {
      if (!flags.topic) {
        this.error('--topic is required with --optimize')
      }
      const optimizeInput = {
        videoPath: flags.video ?? '',
        platform: (flags.platforms?.[0] ?? 'tiktok') as 'tiktok' | 'instagram' | 'facebook',
        topic: flags.topic,
        niche: flags.niche,
        audience: flags.audience,
        description: flags['video-description'],
        duration: flags.duration,
      }
      const workflow = resolveWorkflow({optimize: optimizeInput})

      this.log(`Workflow mode: ${workflow.mode}`)
      this.log(`Active stages: ${workflow.stages.join(' -> ')}`)

      const projectRoot = process.cwd()
      const config: OrchestratorConfig = {
        platforms: flags.platforms ?? [optimizeInput.platform],
        dryRun: flags['dry-run'],
        budgetLimit: flags.budget ?? 10,
        disabledAgents: [],
        projectRoot,
        activeStages: [...workflow.stages],
        workflowMode: 'optimize',
        optimizeContext: optimizeInput,
        postsPerPlatform: flags.posts,
      }

      const executionMode = flags.mode as ExecutionMode
      const executor = createExecutor(executionMode)
      const stageRunner = new StageRunner({executor})

      try {
        const events = {
          onStageStart: (stage: string) => this.log(`\n> Stage: ${stage}`),
          onStageComplete: (stage: string, result: {status: string}) => {
            this.log(`  ${stage}: ${result.status}`)
          },
          onPipelinePaused: (stage: string) => {
            this.log(`\nPipeline paused at ${stage}`)
          },
        }

        const orchestrator = await Orchestrator.create(config, stageRunner, events)
        const result = await orchestrator.execute()

        this.log(`\nPipeline ${result.status}: ${result.id}`)

        if (result.status === 'paused') {
          this.log('Use `mat review list` to review optimized metadata.')
          this.log(`Resume with: mat run --resume ${result.id}`)
        }
      } catch (error) {
        if (error instanceof MATError) {
          this.error(`[${error.code}] ${error.message}\nReason: ${error.reason}\nFix: ${error.resolution}`)
        }
        throw error
      }
      return
    }

    // Resolve workflow from inputs
    const workflow = resolveWorkflow({
      briefPath: flags.brief,
      idea: flags.idea,
    })

    this.log(`Workflow mode: ${workflow.mode}`)
    this.log(`Active stages: ${workflow.stages.join(' -> ')}`)

    const projectRoot = process.cwd()
    const config: OrchestratorConfig = {
      platforms: flags.platforms ?? ['reddit'],
      dryRun: flags['dry-run'],
      budgetLimit: flags.budget ?? 10,
      disabledAgents: [],
      projectRoot,
      activeStages: [...workflow.stages],
      postsPerPlatform: flags.posts,
    }

    // If brief mode, load the brief content
    if (flags.brief) {
      try {
        const briefContent = await readFile(flags.brief, 'utf-8')
        config.brandContext = (config.brandContext ?? '') + '\n\n## Brief\n\n' + briefContent
      } catch (error) {
        this.error(`Failed to read brief file: ${flags.brief}`)
      }
    }

    // If idea mode, inject the idea
    if (flags.idea) {
      config.brandContext = (config.brandContext ?? '') + '\n\n## Topic/Idea\n\n' + flags.idea
    }

    const executionMode = flags.mode as ExecutionMode
    const executor = createExecutor(executionMode)
    const stageRunner = new StageRunner({executor})

    try {
      const events = {
        onStageStart: (stage: string) => this.log(`\n> Stage: ${stage}`),
        onStageComplete: (stage: string, result: {status: string}) => {
          this.log(`  ${stage}: ${result.status}`)
        },
        onPipelinePaused: (stage: string) => {
          this.log(`\nPipeline paused at ${stage}`)
        },
      }

      const orchestrator = await Orchestrator.create(config, stageRunner, events)
      const result = await orchestrator.execute()

      this.log(`\nPipeline ${result.status}: ${result.id}`)

      if (result.status === 'paused') {
        this.log('Use `mat review list` to review content.')
        this.log(`Resume with: mat run --resume ${result.id}`)
      }
    } catch (error) {
      if (error instanceof MATError) {
        this.error(`[${error.code}] ${error.message}\nReason: ${error.reason}\nFix: ${error.resolution}`)
      }
      throw error
    }
  }

  private async runSingleAgent(agentName: string, mode: ExecutionMode): Promise<void> {
    this.log(`Running single agent: ${agentName}`)

    try {
      const agentDir = await resolveAgentDir(agentName)
      const skill = await loadSkill(agentDir)

      let systemPrompt = skill.systemPrompt
      if (skill.knowledgeContext) {
        systemPrompt += '\n\n---\n\n' + skill.knowledgeContext
      }

      const executor = createExecutor(mode)
      const result = await executeAgent(agentName, {
        prompt: 'Execute your task now. Return your analysis as JSON.',
        systemPrompt,
        allowedTools: skill.tools,
        model: skill.model,
        outputSchema: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]),
      }, executor)

      this.log(`\nAgent: ${result.agentName}`)
      this.log(`Status: ${result.status}`)
      this.log(`Cost: $${result.usage.cost.toFixed(4)}`)
      this.log(`Duration: ${result.duration}ms`)
      this.log(`\nOutput:`)
      this.log(JSON.stringify(result.outputs, null, 2))
    } catch (error) {
      if (error instanceof MATError) {
        this.error(`[${error.code}] ${error.message}`)
      }
      throw error
    }
  }
}
