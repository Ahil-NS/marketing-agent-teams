import type {SkillDefinition} from './types.js'

/**
 * Load an agent SKILL.md definition by agent name.
 *
 * Stub implementation — will be replaced by Story 2.9 with full SKILL.md parsing,
 * knowledge/ concatenation, and template/ loading.
 *
 * @throws Error — not yet implemented
 */
export async function loadSkill(_agentName: string): Promise<SkillDefinition> {
  throw new Error(
    `loadSkill() is not yet implemented. Full implementation arrives in Story 2.9 (skill-loader-and-agent-knowledge-base).`,
  )
}
