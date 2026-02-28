export interface SandboxFinding {
  severity: 'error' | 'warning'
  pattern: string
  line: number
  message: string
  remediation: string
}

export interface SandboxValidationResult {
  safe: boolean
  findings: SandboxFinding[]
}

/**
 * Injection patterns that indicate code execution attempts.
 * Each pattern includes the regex, severity, and human-readable description.
 */
const INJECTION_PATTERNS: Array<{
  pattern: RegExp
  severity: 'error' | 'warning'
  message: string
  remediation: string
}> = [
  {
    pattern: /<script[\s>]/i,
    severity: 'error',
    message: 'Script tag detected — SKILL.md must not contain executable HTML',
    remediation: 'Remove all <script> tags. SKILL.md is markdown text only.',
  },
  {
    pattern: /\bimport\s*\(/,
    severity: 'error',
    message: 'Dynamic import() detected — SKILL.md must not contain JavaScript imports',
    remediation: 'Remove import() calls. Agent capabilities come from declared tools, not code imports.',
  },
  {
    pattern: /\brequire\s*\(/,
    severity: 'error',
    message: 'require() detected — SKILL.md must not contain Node.js module loading',
    remediation: 'Remove require() calls. Agent capabilities come from declared tools, not code imports.',
  },
  {
    pattern: /\beval\s*\(/,
    severity: 'error',
    message: 'eval() detected — SKILL.md must not contain code evaluation',
    remediation: 'Remove eval() calls. SKILL.md content is never executed as code.',
  },
  {
    pattern: /\bFunction\(/,
    severity: 'error',
    message: 'Function() constructor detected — SKILL.md must not contain code generation',
    remediation: 'Remove Function() constructor. SKILL.md content is never executed as code.',
  },
  {
    pattern: /\$\(/,
    severity: 'error',
    message: 'Shell command substitution $() detected — potential command injection',
    remediation: 'Remove shell command substitution. Agent shell access is controlled via Bash tool permissions.',
  },
  {
    pattern: /\.\.\//,
    severity: 'error',
    message: 'Path traversal sequence "../" detected — agent must not reference files outside its directory',
    remediation: "Use relative paths within the agent's own knowledge/ and templates/ directories only.",
  },
  {
    pattern: /^\/[a-z]/im,
    severity: 'warning',
    message: 'Absolute path detected — agent should use relative paths within its own directory',
    remediation: 'Replace absolute paths with relative references to knowledge/ or templates/ files.',
  },
  {
    pattern: /process\.env/,
    severity: 'warning',
    message: 'process.env reference detected — agents must not access environment variables directly',
    remediation: 'Remove process.env references. Credentials are injected via CredentialManager, not environment variables.',
  },
  {
    pattern: /https?:\/\/[^\s]*[?&](token|key|secret|password|auth)=/i,
    severity: 'error',
    message: 'URL with sensitive query parameter detected — potential credential exfiltration',
    remediation: 'Remove URLs containing token/key/secret parameters. Credentials must never appear in URLs.',
  },
]

/**
 * Static analysis of raw SKILL.md content before YAML parsing.
 * Detects code injection, path traversal, and credential exfiltration patterns.
 *
 * Called by skill-loader (Story 2.9) as the first step in loading a SKILL.md file.
 * If any error-severity finding is detected, the load is blocked.
 */
export function validateSkillMdSafety(
  rawContent: string,
): SandboxValidationResult {
  const findings: SandboxFinding[] = []
  const lines = rawContent.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const check of INJECTION_PATTERNS) {
      if (check.pattern.test(line)) {
        findings.push({
          severity: check.severity,
          pattern: check.pattern.source,
          line: i + 1,
          message: check.message,
          remediation: check.remediation,
        })
      }
    }
  }

  const hasErrors = findings.some((f) => f.severity === 'error')

  return {
    safe: !hasErrors,
    findings,
  }
}
