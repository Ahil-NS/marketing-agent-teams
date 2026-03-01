import {readFile, readdir, access} from 'node:fs/promises'
import {join} from 'node:path'

import {validateSkillMdSafety} from './sandbox-validator.js'
import type {SandboxFinding} from './sandbox-validator.js'

/**
 * A single finding from the security lint analysis.
 * Includes severity, rule violated, source file, line number, and remediation guidance.
 */
export interface SecurityLintFinding {
  severity: 'error' | 'warning'
  rule: string
  file: string
  line: number
  message: string
  remediation: string
}

/**
 * Result of running all security lint rules on an agent directory.
 * `safe` is true only if there are zero error-severity findings.
 */
export interface SecurityLintResult {
  safe: boolean
  findings: SecurityLintFinding[]
  filesScanned: number
  rulesApplied: number
}

// ---------------------------------------------------------------------------
// Prompt injection patterns — detect common prompt override attempts
// ---------------------------------------------------------------------------
const PROMPT_INJECTION_PATTERNS: Array<{pattern: RegExp; description: string}> = [
  {pattern: /ignore\s+(all\s+)?previous\s+instructions/i, description: 'Prompt override: "ignore previous instructions"'},
  {pattern: /you\s+are\s+now\s+/i, description: 'Identity override: "you are now ..."'},
  {pattern: /system:\s*override/i, description: 'System override directive'},
  {pattern: /IMPORTANT:\s*disregard/i, description: 'Disregard directive with emphasis'},
  {pattern: /forget\s+(everything|all)\s+(you|above)/i, description: 'Memory wipe: "forget everything"'},
  {pattern: /new\s+instructions:/i, description: 'Instruction replacement: "new instructions:"'},
]

// ---------------------------------------------------------------------------
// External URL pattern — detect hardcoded API endpoints (allow doc links)
// ---------------------------------------------------------------------------
const EXTERNAL_URL_PATTERN = /https?:\/\/[^\s)>\]]+/gi
const ALLOWED_URL_HOSTS = [
  'developer.apple.com',
  'docs.',
  'github.com',
  'developer.mozilla.org',
  'wikipedia.org',
  'learn.microsoft.com',
  'stackoverflow.com',
]

// ---------------------------------------------------------------------------
// Credential reference patterns
// ---------------------------------------------------------------------------
const CREDENTIAL_PATTERNS: RegExp[] = [
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /access[_-]?token/i,
  /\bbearer\b/i,
  /\bauthorization\b/i,
]

// ---------------------------------------------------------------------------
// Undeclared permission — tool references in markdown body
// ---------------------------------------------------------------------------
const TOOL_REFERENCE_PATTERNS: Array<{pattern: RegExp; tool: string}> = [
  {pattern: /\buse\s+bash\b/i, tool: 'Bash'},
  {pattern: /\brun\s+(a\s+)?command\b/i, tool: 'Bash'},
  {pattern: /\bexecute\s+(a\s+)?command\b/i, tool: 'Bash'},
  {pattern: /\bwrite\s+to\s+file\b/i, tool: 'Write'},
  {pattern: /\bedit\s+(the\s+)?file\b/i, tool: 'Edit'},
  {pattern: /\bshell\s+command\b/i, tool: 'Bash'},
]

// ---------------------------------------------------------------------------
// Write/execute tools that community agents should not declare
// ---------------------------------------------------------------------------
const RESTRICTED_COMMUNITY_TOOLS = ['Write', 'Edit', 'Bash']

/**
 * Total number of semantic rules applied (excluding sandbox patterns).
 * Prompt injection (1), external URLs (1), credential references (1),
 * undeclared permissions (1), overly broad tool scopes (1), knowledge traversal (1).
 */
const SEMANTIC_RULE_COUNT = 6

/**
 * Convert a SandboxFinding to a SecurityLintFinding.
 */
function sandboxToLintFinding(finding: SandboxFinding, file: string): SecurityLintFinding {
  return {
    severity: finding.severity,
    rule: 'sandbox-pattern',
    file,
    line: finding.line,
    message: finding.message,
    remediation: finding.remediation,
  }
}

/**
 * Check for prompt injection patterns in raw content.
 */
function checkPromptInjection(content: string, file: string): SecurityLintFinding[] {
  const findings: SecurityLintFinding[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const {pattern, description} of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          severity: 'error',
          rule: 'prompt-injection',
          file,
          line: i + 1,
          message: `Prompt injection pattern detected: ${description}`,
          remediation: 'Remove prompt injection patterns. SKILL.md instructions must not attempt to override the system prompt.',
        })
      }
    }
  }

  return findings
}

/**
 * Check for external URLs that are not documentation links.
 */
function checkExternalUrls(content: string, file: string): SecurityLintFinding[] {
  const findings: SecurityLintFinding[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const matches = line.matchAll(EXTERNAL_URL_PATTERN)

    for (const match of matches) {
      const url = match[0]
      const isAllowed = ALLOWED_URL_HOSTS.some((host) => url.includes(host))
      if (!isAllowed) {
        findings.push({
          severity: 'warning',
          rule: 'external-url',
          file,
          line: i + 1,
          message: `External URL detected: ${url} — verify this is not a data exfiltration endpoint`,
          remediation: 'Remove hardcoded external URLs. If this is a documentation link, consider using an allowed domain (docs.*, github.com).',
        })
      }
    }
  }

  return findings
}

/**
 * Check for credential references in markdown body.
 */
function checkCredentialReferences(content: string, file: string): SecurityLintFinding[] {
  const findings: SecurityLintFinding[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const pattern of CREDENTIAL_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          severity: 'warning',
          rule: 'credential-reference',
          file,
          line: i + 1,
          message: `Credential reference in prompt text: "${line.trim().slice(0, 80)}"`,
          remediation: 'Remove credential references. Agents should not handle credentials directly — they are injected via CredentialManager.',
        })
        break // Only report once per line across all credential patterns
      }
    }
  }

  return findings
}

/**
 * Check for tool references in markdown body that aren't in declared toolScopes.
 */
function checkUndeclaredPermissions(
  content: string,
  file: string,
  declaredToolScopes: string[],
): SecurityLintFinding[] {
  const findings: SecurityLintFinding[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const {pattern, tool} of TOOL_REFERENCE_PATTERNS) {
      if (pattern.test(line) && !declaredToolScopes.includes(tool)) {
        findings.push({
          severity: 'warning',
          rule: 'undeclared-tool',
          file,
          line: i + 1,
          message: `Implied use of tool "${tool}" not declared in permissions.toolScopes`,
          remediation: `Add "${tool}" to permissions.toolScopes if this agent needs it, or remove the tool reference from the prompt text.`,
        })
      }
    }
  }

  return findings
}

/**
 * Check if a community agent declares overly broad tool scopes.
 */
function checkBroadToolScopes(
  trustTier: string,
  declaredToolScopes: string[],
  file: string,
): SecurityLintFinding[] {
  if (trustTier !== 'community') return []

  const findings: SecurityLintFinding[] = []
  for (const tool of declaredToolScopes) {
    if (RESTRICTED_COMMUNITY_TOOLS.includes(tool)) {
      findings.push({
        severity: 'warning',
        rule: 'broad-tool-scope',
        file,
        line: 1,
        message: `Tool "${tool}" declared but will be blocked for community tier agents`,
        remediation: `Remove "${tool}" from permissions.toolScopes — community agents cannot use write/execute tools. Use "mat agents trust" to promote the agent if needed.`,
      })
    }
  }

  return findings
}

/**
 * Run security lint on a single agent directory.
 * Orchestrates sandbox-validator patterns and semantic rules.
 *
 * @param agentDir - Absolute path to the agent directory containing SKILL.md
 * @returns SecurityLintResult with all findings
 */
export async function runSecurityLint(agentDir: string): Promise<SecurityLintResult> {
  const findings: SecurityLintFinding[] = []
  let filesScanned = 0

  const skillPath = join(agentDir, 'SKILL.md')
  let content: string
  try {
    content = await readFile(skillPath, 'utf-8')
  } catch {
    return {
      safe: false,
      findings: [{
        severity: 'error',
        rule: 'file-not-found',
        file: 'SKILL.md',
        line: 0,
        message: 'SKILL.md not found in agent directory',
        remediation: `Create a SKILL.md file in "${agentDir}" with YAML front matter and markdown body`,
      }],
      filesScanned: 0,
      rulesApplied: SEMANTIC_RULE_COUNT,
    }
  }

  filesScanned++

  // 1. Run sandbox validator on SKILL.md
  const sandboxResult = validateSkillMdSafety(content)
  for (const finding of sandboxResult.findings) {
    findings.push(sandboxToLintFinding(finding, 'SKILL.md'))
  }

  // 2. Extract front matter for context-aware rules
  let trustTier = 'builtin'
  let declaredToolScopes: string[] = []

  // Simple front-matter extraction (avoid dependency on skill-loader to keep lint standalone)
  const trimmed = content.trimStart()
  if (trimmed.startsWith('---')) {
    const closingIdx = trimmed.indexOf('\n---', 3)
    if (closingIdx !== -1) {
      const yamlBlock = trimmed.slice(3, closingIdx)
      // Extract trustTier
      const trustMatch = yamlBlock.match(/trustTier:\s*(\S+)/)
      if (trustMatch) trustTier = trustMatch[1]

      // Extract toolScopes from permissions block
      const toolScopesMatch = yamlBlock.match(/toolScopes:\s*\n((?:\s+-\s+\S+\n?)+)/)
      if (toolScopesMatch) {
        declaredToolScopes = toolScopesMatch[1]
          .split('\n')
          .map((l) => l.replace(/^\s*-\s*/, '').trim())
          .filter(Boolean)
      }
    }
  }

  // Get body (after front matter)
  const bodyStart = trimmed.indexOf('\n---', 3)
  const body = bodyStart !== -1 ? trimmed.slice(bodyStart + 4) : content

  // 3. Semantic rules on SKILL.md body
  findings.push(...checkPromptInjection(body, 'SKILL.md'))
  findings.push(...checkExternalUrls(body, 'SKILL.md'))
  findings.push(...checkCredentialReferences(body, 'SKILL.md'))
  findings.push(...checkUndeclaredPermissions(body, 'SKILL.md', declaredToolScopes))
  findings.push(...checkBroadToolScopes(trustTier, declaredToolScopes, 'SKILL.md'))

  // 4. Scan knowledge/ directory files
  const knowledgePath = join(agentDir, 'knowledge')
  try {
    await access(knowledgePath)
    const entries = await readdir(knowledgePath)
    const mdFiles = entries.filter((f) => f.endsWith('.md')).sort()

    for (const file of mdFiles) {
      const filePath = join(knowledgePath, file)
      try {
        const knowledgeContent = await readFile(filePath, 'utf-8')
        filesScanned++
        const relFile = `knowledge/${file}`

        // Run sandbox patterns on knowledge files
        const knowledgeSandbox = validateSkillMdSafety(knowledgeContent)
        for (const finding of knowledgeSandbox.findings) {
          findings.push(sandboxToLintFinding(finding, relFile))
        }

        // Run prompt injection check on knowledge files
        findings.push(...checkPromptInjection(knowledgeContent, relFile))
      } catch {
        // Skip unreadable knowledge files
      }
    }
  } catch {
    // knowledge/ directory doesn't exist — that's fine
  }

  const hasErrors = findings.some((f) => f.severity === 'error')

  return {
    safe: !hasErrors,
    findings,
    filesScanned,
    rulesApplied: SEMANTIC_RULE_COUNT,
  }
}
