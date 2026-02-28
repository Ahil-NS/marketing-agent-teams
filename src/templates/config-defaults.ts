// Default configuration values for new MAT projects
// Single source of truth — used by scaffolder during `mat install`

export const DEFAULT_BRAND_VOICE = {
  tone: 'professional',
  communicationStyle: 'clear and direct',
  brandPrinciples: [] as string[],
  bannedPhrases: [] as string[],
} as const

export const DEFAULT_AGENTS = {
  defaultModel: 'sonnet',
  budgetLimit: 10,
  toggles: {} as Record<string, {enabled: boolean}>,
} as const
