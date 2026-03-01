import {z} from 'zod'

// --- Variation Type Enum ---

export const variationTypeSchema = z.enum([
  'hook',
  'caption',
  'hashtag',
  'format',
  'cta',
])

export type VariationType = z.infer<typeof variationTypeSchema>

// --- A/B Test Output Schema ---

export const abTestOutputSchema = z.object({
  testPlans: z.array(
    z.object({
      testId: z.string().min(1),
      originalContentItemId: z.string().min(1),
      hypothesis: z.string().min(1),
      variableUnderTest: variationTypeSchema,
      successMetric: z.string().min(1),
    }),
  ).min(1),
  variations: z.array(
    z.object({
      variationId: z.string().min(1),
      testId: z.string().min(1),
      originalContentItemId: z.string().min(1),
      variationType: variationTypeSchema,
      variationDescription: z.string().min(1),
      content: z.string().min(1),
      changeDetails: z.string().min(1),
    }),
  ).min(1),
  recommendations: z.object({
    primaryTestId: z.string().min(1),
    rationale: z.string().min(1),
    expectedImpact: z.string().min(1),
    testDuration: z.string().min(1),
  }),
  summary: z.object({
    totalVariations: z.number().int().min(1),
    variationsByType: z.object({
      hook: z.number().int().min(0).optional(),
      caption: z.number().int().min(0).optional(),
      hashtag: z.number().int().min(0).optional(),
      format: z.number().int().min(0).optional(),
      cta: z.number().int().min(0).optional(),
    }),
    contentItemsCovered: z.number().int().min(1),
  }),
})

export type AbTestOutput = z.infer<typeof abTestOutputSchema>

// --- A/B Test Inputs Schema ---

export const abTestInputsSchema = z.object({
  contentItems: z.array(
    z.object({
      id: z.string().min(1),
      platform: z.string().min(1),
      content: z.string().min(1),
    }),
  ).min(1),
  brandVoiceTone: z.string().min(1),
  brandVoiceStyle: z.string().min(1),
})

export type AbTestInputs = z.infer<typeof abTestInputsSchema>

// --- Content Variation Schema (pipeline state) ---

export const contentVariationSchema = z.object({
  variationId: z.string().min(1),
  originalContentItemId: z.string().min(1),
  testId: z.string().min(1),
  variationType: variationTypeSchema,
  variationDescription: z.string().min(1),
  content: z.string().min(1),
})

export type ContentVariation = z.infer<typeof contentVariationSchema>
