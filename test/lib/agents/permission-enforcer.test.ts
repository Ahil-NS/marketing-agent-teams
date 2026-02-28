import {describe, it, expect} from 'vitest'

import {PermissionEnforcer} from '../../../src/lib/agents/permission-enforcer.js'
import {PermissionDeniedError} from '../../../src/lib/agents/errors.js'
import {TrustViolationError} from '../../../src/lib/credentials/errors.js'
import type {SkillDefinition} from '../../../src/lib/agents/types.js'
import type {TrustTier} from '../../../src/lib/credentials/types.js'

function createSkillDef(overrides?: Partial<SkillDefinition>): SkillDefinition {
  return {
    name: 'test-agent',
    description: 'A test agent',
    cluster: 'intelligence',
    model: 'haiku',
    tools: [],
    trustTier: 'builtin',
    permissions: {credentials: [], dataScopes: [], toolScopes: []},
    systemPrompt: 'You are a test agent.',
    knowledgeContext: '',
    templates: {},
    ...overrides,
  }
}

describe('PermissionEnforcer', () => {
  const enforcer = new PermissionEnforcer()

  describe('validatePermissions', () => {
    it('builtin tier agent with full permissions → all tools resolved, no violations', () => {
      const skill = createSkillDef({
        name: 'full-agent',
        tools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Task'],
        trustTier: 'builtin',
        permissions: {
          credentials: ['reddit-oauth'],
          dataScopes: ['pipeline-state', 'brand-config'],
          toolScopes: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Task'],
        },
      })
      const result = enforcer.validatePermissions(skill, 'builtin')
      expect(result.allowed).toBe(true)
      expect(result.violations).toEqual([])
      expect(result.effectiveTools).toEqual([
        'WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Task',
      ])
      expect(result.trustTier).toBe('builtin')
      expect(result.agentName).toBe('full-agent')
    })

    it('verified tier agent requesting Bash → tool removed from effective tools, violation logged', () => {
      const skill = createSkillDef({
        name: 'verified-agent',
        tools: ['WebSearch', 'Read', 'Bash'],
        trustTier: 'verified',
        permissions: {
          credentials: [],
          dataScopes: [],
          toolScopes: ['WebSearch', 'Read', 'Bash'],
        },
      })
      const result = enforcer.validatePermissions(skill, 'verified')
      expect(result.allowed).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations[0]).toContain('Bash')
      expect(result.effectiveTools).toContain('WebSearch')
      expect(result.effectiveTools).toContain('Read')
      expect(result.effectiveTools).not.toContain('Bash')
    })

    it('community tier agent requesting Write or Edit → tools removed, only read-safe tools remain', () => {
      const skill = createSkillDef({
        name: 'community-writer',
        tools: ['WebSearch', 'Read', 'Write', 'Edit'],
        trustTier: 'community',
        permissions: {
          credentials: [],
          dataScopes: ['content-items'],
          toolScopes: ['WebSearch', 'Read', 'Write', 'Edit'],
        },
      })
      const result = enforcer.validatePermissions(skill, 'community')
      expect(result.allowed).toBe(false)
      expect(result.violations.some((v) => v.includes('Write'))).toBe(true)
      expect(result.effectiveTools).toContain('WebSearch')
      expect(result.effectiveTools).toContain('Read')
      expect(result.effectiveTools).not.toContain('Write')
      expect(result.effectiveTools).not.toContain('Edit')
    })

    it('community tier agent requesting credentials → violation reported', () => {
      const skill = createSkillDef({
        name: 'community-cred',
        tools: ['WebSearch'],
        trustTier: 'community',
        permissions: {
          credentials: ['reddit-oauth'],
          dataScopes: [],
          toolScopes: ['WebSearch'],
        },
      })
      const result = enforcer.validatePermissions(skill, 'community')
      expect(result.allowed).toBe(false)
      expect(result.violations.some((v) => v.includes('credential access'))).toBe(true)
      expect(result.violations.some((v) => v.includes('reddit-oauth'))).toBe(true)
    })

    it('agent with empty permissions block → zero tools, zero credentials, zero data scopes', () => {
      const skill = createSkillDef({
        name: 'empty-perms',
        tools: [],
        permissions: {credentials: [], dataScopes: [], toolScopes: []},
      })
      const result = enforcer.validatePermissions(skill, 'builtin')
      expect(result.allowed).toBe(true)
      expect(result.effectiveTools).toEqual([])
      expect(result.violations).toEqual([])
    })

    it('agent with no permissions block → defaults to zero permissions (deny-by-default)', () => {
      const skill = createSkillDef({
        name: 'no-perms',
        tools: [],
      })
      delete skill.permissions
      const result = enforcer.validatePermissions(skill, 'builtin')
      expect(result.allowed).toBe(true)
      expect(result.effectiveTools).toEqual([])
    })

    it('reports violation when toolScopes references undeclared tools', () => {
      const skill = createSkillDef({
        name: 'mismatched-scopes',
        tools: ['WebSearch'],
        permissions: {
          credentials: [],
          dataScopes: [],
          toolScopes: ['WebSearch', 'WebFetch'], // WebFetch not in tools
        },
      })
      const result = enforcer.validatePermissions(skill, 'builtin')
      expect(result.allowed).toBe(false)
      expect(result.violations.some((v) => v.includes('WebFetch'))).toBe(true)
      expect(result.violations.some((v) => v.includes("not declared in 'tools'"))).toBe(true)
    })
  })

  describe('resolveEffectiveTools', () => {
    it('returns intersection of declared + tier-allowed, never union', () => {
      const skill = createSkillDef({
        tools: ['WebSearch', 'Read', 'Bash', 'Write'],
      })

      // Community tier: only WebSearch, WebFetch, Read, Glob, Grep allowed
      const effective = enforcer.resolveEffectiveTools(skill, 'community')
      expect(effective).toEqual(['WebSearch', 'Read'])
      expect(effective).not.toContain('Bash')
      expect(effective).not.toContain('Write')
    })

    it('builtin tier preserves all declared tools', () => {
      const skill = createSkillDef({
        tools: ['WebSearch', 'Bash', 'Write', 'Task'],
      })
      const effective = enforcer.resolveEffectiveTools(skill, 'builtin')
      expect(effective).toEqual(['WebSearch', 'Bash', 'Write', 'Task'])
    })

    it('verified tier filters out only Bash', () => {
      const skill = createSkillDef({
        tools: ['WebSearch', 'Bash', 'Write', 'Task'],
      })
      const effective = enforcer.resolveEffectiveTools(skill, 'verified')
      expect(effective).toEqual(['WebSearch', 'Write', 'Task'])
      expect(effective).not.toContain('Bash')
    })

    it('returns empty array when no tools declared', () => {
      const skill = createSkillDef({tools: []})
      const effective = enforcer.resolveEffectiveTools(skill, 'builtin')
      expect(effective).toEqual([])
    })

    it('returns empty array when all declared tools are blocked by tier', () => {
      const skill = createSkillDef({
        tools: ['Write', 'Edit', 'Bash', 'Task'],
      })
      const effective = enforcer.resolveEffectiveTools(skill, 'community')
      expect(effective).toEqual([])
    })
  })

  describe('enforceToolScope', () => {
    it('allows access to declared tool', () => {
      expect(() => {
        enforcer.enforceToolScope(['WebSearch', 'Read'], 'WebSearch', 'test-agent')
      }).not.toThrow()
    })

    it('throws PermissionDeniedError for undeclared tool', () => {
      expect(() => {
        enforcer.enforceToolScope(['WebSearch', 'Read'], 'Bash', 'test-agent')
      }).toThrow(PermissionDeniedError)
    })

    it('PermissionDeniedError includes agent name and requested tool', () => {
      try {
        enforcer.enforceToolScope(['WebSearch'], 'Bash', 'my-agent')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionDeniedError)
        const permError = error as PermissionDeniedError
        expect(permError.message).toContain('my-agent')
        expect(permError.message).toContain('Bash')
        expect(permError.code).toBe('PERMISSION_DENIED')
        expect(permError.severity).toBe('permanent')
      }
    })

    it('throws for empty declared tools', () => {
      expect(() => {
        enforcer.enforceToolScope([], 'WebSearch', 'test-agent')
      }).toThrow(PermissionDeniedError)
    })
  })

  describe('enforceCredentialScope', () => {
    it('allows access to declared credential', () => {
      expect(() => {
        enforcer.enforceCredentialScope(['reddit-oauth'], 'reddit-oauth', 'test-agent')
      }).not.toThrow()
    })

    it('throws TrustViolationError for undeclared credential', () => {
      expect(() => {
        enforcer.enforceCredentialScope(['reddit-oauth'], 'tiktok-oauth', 'test-agent')
      }).toThrow(TrustViolationError)
    })

    it('TrustViolationError explains mismatch', () => {
      try {
        enforcer.enforceCredentialScope(['reddit-oauth'], 'tiktok-oauth', 'my-agent')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(TrustViolationError)
        const trustError = error as TrustViolationError
        expect(trustError.message).toContain('my-agent')
        expect(trustError.message).toContain('tiktok-oauth')
        expect(trustError.message).toContain('reddit-oauth')
        expect(trustError.code).toBe('CREDENTIAL_TRUST_VIOLATION')
        expect(trustError.severity).toBe('permanent')
      }
    })

    it('throws for empty declared credentials', () => {
      expect(() => {
        enforcer.enforceCredentialScope([], 'reddit-oauth', 'test-agent')
      }).toThrow(TrustViolationError)
    })
  })

  describe('enforceDataScope', () => {
    it('allows access to declared data scope', () => {
      expect(() => {
        enforcer.enforceDataScope(['pipeline-state', 'brand-config'], 'pipeline-state', 'test-agent')
      }).not.toThrow()
    })

    it('throws PermissionDeniedError for undeclared data scope', () => {
      expect(() => {
        enforcer.enforceDataScope(['pipeline-state'], 'content-items', 'test-agent')
      }).toThrow(PermissionDeniedError)
    })

    it('PermissionDeniedError includes data scope context', () => {
      try {
        enforcer.enforceDataScope(['pipeline-state'], 'content-items', 'my-agent')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionDeniedError)
        const permError = error as PermissionDeniedError
        expect(permError.message).toContain('my-agent')
        expect(permError.message).toContain('content-items')
        expect(permError.message).toContain('data scope')
        expect(permError.code).toBe('PERMISSION_DENIED')
      }
    })

    it('throws for empty declared data scopes', () => {
      expect(() => {
        enforcer.enforceDataScope([], 'pipeline-state', 'test-agent')
      }).toThrow(PermissionDeniedError)
    })
  })

  describe('trust tier tool restrictions', () => {
    it('builtin tier allows all SDK tools', () => {
      const skill = createSkillDef({
        tools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Task'],
      })
      const effective = enforcer.resolveEffectiveTools(skill, 'builtin')
      expect(effective).toHaveLength(9)
    })

    it('verified tier allows all except Bash', () => {
      const skill = createSkillDef({
        tools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Task'],
      })
      const effective = enforcer.resolveEffectiveTools(skill, 'verified')
      expect(effective).toHaveLength(8)
      expect(effective).not.toContain('Bash')
    })

    it('community tier allows only read-safe tools', () => {
      const skill = createSkillDef({
        tools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Task'],
      })
      const effective = enforcer.resolveEffectiveTools(skill, 'community')
      expect(effective).toEqual(['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'])
    })
  })

  describe('error class properties', () => {
    it('PermissionDeniedError extends MATError with correct code', () => {
      const error = new PermissionDeniedError('agent-x', 'tool', 'Bash', ['WebSearch'])
      expect(error.code).toBe('PERMISSION_DENIED')
      expect(error.severity).toBe('permanent')
      expect(error.source).toBe('permission-enforcer')
      expect(error.message).toContain('agent-x')
      expect(error.message).toContain('Bash')
      expect(error.resolution).toContain('toolScopes')
    })

    it('PermissionDeniedError for dataScope includes dataScopes in resolution', () => {
      const error = new PermissionDeniedError('agent-x', 'dataScope', 'content-items', ['pipeline-state'])
      expect(error.resolution).toContain('dataScopes')
      expect(error.message).toContain('data scope')
    })
  })
})
