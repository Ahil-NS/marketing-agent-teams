import {beforeEach, describe, expect, it, vi} from 'vitest'

import {createTestPipelineRun} from '../helpers/pipeline-state-factory.js'

// Mock the orchestrator state-serializer module
vi.mock('../../src/lib/orchestrator/state-serializer.js', () => ({
  loadPipelineRun: vi.fn(),
  listPipelineRuns: vi.fn(),
  pipelineRunExists: vi.fn(),
  savePipelineRun: vi.fn(),
}))

import {loadPipelineRun, listPipelineRuns} from '../../src/lib/orchestrator/state-serializer.js'

// Import the command to test
import Status from '../../src/commands/status.js'

const mockedLoadPipelineRun = vi.mocked(loadPipelineRun)
const mockedListPipelineRuns = vi.mocked(listPipelineRuns)

describe('mat status command', () => {
  let logOutput: string[]

  beforeEach(() => {
    logOutput = []
    vi.clearAllMocks()
  })

  function createCommandInstance(): Status {
    const cmd = new Status([], {} as any)
    cmd.log = (...args: any[]) => {
      logOutput.push(args.join(' '))
    }
    return cmd
  }

  it('shows most recent run status by default', async () => {
    const run = createTestPipelineRun({status: 'running'})
    mockedListPipelineRuns.mockResolvedValue([run.id])
    mockedLoadPipelineRun.mockResolvedValue(run)

    const cmd = createCommandInstance()
    // Override parse to return expected flags
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, history: false, json: false},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toEqual(run)
    expect(logOutput.join('\n')).toContain('Pipeline Run:')
    expect(logOutput.join('\n')).toContain('Status: running')
  })

  it('shows specific run when --run-id is provided', async () => {
    const run = createTestPipelineRun({id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'})
    mockedLoadPipelineRun.mockResolvedValue(run)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', history: false, json: false},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toEqual(run)
    expect(mockedLoadPipelineRun).toHaveBeenCalledWith('a1b2c3d4-e5f6-7890-abcd-ef1234567890', expect.any(String))
  })

  it('shows history when --history flag is set', async () => {
    const runs = [
      createTestPipelineRun({id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'completed'}),
      createTestPipelineRun({id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', status: 'running'}),
    ]
    mockedListPipelineRuns.mockResolvedValue(runs.map((r) => r.id))
    mockedLoadPipelineRun
      .mockResolvedValueOnce(runs[0])
      .mockResolvedValueOnce(runs[1])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, history: true, json: false},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toEqual(runs)
    expect(logOutput.join('\n')).toContain('Pipeline Run History:')
  })

  it('shows helpful message when no runs exist', async () => {
    mockedListPipelineRuns.mockResolvedValue([])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, history: false, json: false},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toBeNull()
    expect(logOutput.join('\n')).toContain('No pipeline runs found')
    expect(logOutput.join('\n')).toContain('mat run')
  })

  it('returns raw PipelineRun for --json', async () => {
    const run = createTestPipelineRun()
    mockedListPipelineRuns.mockResolvedValue([run.id])
    mockedLoadPipelineRun.mockResolvedValue(run)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, history: false, json: true},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    // The return value is what oclif serializes to JSON
    expect(result).toEqual(run)
  })
})
