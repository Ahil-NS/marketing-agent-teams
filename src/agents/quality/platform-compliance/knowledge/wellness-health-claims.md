# Wellness & Health Claims — Compliance Knowledge Base

## Overview

Health claims in marketing content are regulated by the FDA (Food and Drug Administration) and the FTC. Content in the wellness vertical requires additional scrutiny to ensure claims do not cross regulatory boundaries.

## FDA Health Claim Categories

### 1. Structure-Function Claims
- **Definition**: Describe the role of a nutrient or ingredient in maintaining normal body structure or function.
- **Examples**: "Calcium builds strong bones", "Fiber maintains bowel regularity", "Supports immune health"
- **Requirements**: Must include the disclaimer: "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease."
- **Compliance Status**: ALLOWED with required disclaimer

### 2. Qualified Health Claims
- **Definition**: Claims supported by some scientific evidence but not enough for significant scientific agreement (SSA).
- **Examples**: "Some evidence suggests that eating walnuts may reduce the risk of heart disease"
- **Requirements**: Must include qualifying language that accurately reflects the level of evidence
- **Compliance Status**: ALLOWED with specific qualifying language

### 3. Authorized Health Claims
- **Definition**: Claims that have significant scientific agreement and are authorized by the FDA.
- **Examples**: "Diets rich in whole grain foods and other plant foods and low in total fat, saturated fat, and cholesterol may reduce the risk of heart disease and certain cancers."
- **Requirements**: Must use FDA-approved wording
- **Compliance Status**: ALLOWED with FDA-approved wording

## Prohibited Therapeutic Claims

The following types of claims should ALWAYS be flagged as `health-claims` violations with severity `critical`:

### Absolute Cure/Treatment Claims
- "Cures [disease/condition]"
- "Treats [disease/condition]"
- "Heals [disease/condition]"
- "Prevents [disease]"
- "Eliminates [symptoms]"
- "Eradicates [condition]"

### Diagnostic/Medical Claims
- "Diagnoses [condition]"
- "Detects [disease]"
- "If you have [condition], this will help"
- "Proven treatment for [condition]"
- "Doctor-recommended cure"

### Unsubstantiated Medical Outcomes
- "Clinically proven to [medical outcome]" (without peer-reviewed citation)
- "FDA-approved" (when the product is NOT FDA-approved)
- "Prescription-strength" (for non-prescription products)
- "Medical-grade" (for consumer products)

### Specific Health Outcome Guarantees
- "Lose 10 pounds in a week"
- "Guaranteed to lower blood pressure"
- "100% effective at reducing [condition]"
- "Will cure your insomnia"

## Meditation & Mindfulness Content

### Allowed Claims (with appropriate context)
- "May promote relaxation"
- "Some people find meditation helpful for stress management"
- "Practice mindfulness as part of a holistic wellness routine"
- "Meditation can be a useful complement to professional mental health care"

### Claims Requiring Disclaimers (flag as `warning`)
- "Supports mental wellness" → Add: "Individual results may vary. This is not medical advice."
- "Helps reduce stress" → Add: "This is not a substitute for professional medical or mental health treatment."
- "Improves sleep quality" → Add: "Individual experiences may differ. Consult a healthcare provider for sleep disorders."

### Prohibited Claims (flag as `critical`)
- "Meditation cures anxiety/depression"
- "Replaces therapy/medication"
- "Scientifically proven to treat PTSD"
- "Guaranteed to eliminate panic attacks"
- "This program is all you need for mental health"

## Required Disclaimer Patterns

### Supplements / Nutritional Products
```
These statements have not been evaluated by the Food and Drug Administration. 
This product is not intended to diagnose, treat, cure, or prevent any disease.
```

### Wellness / Mindfulness Programs
```
Individual results may vary. This content is for informational purposes only 
and is not intended as medical advice. Consult your healthcare provider before 
making changes to your health routine.
```

### Fitness / Exercise Programs
```
Consult your healthcare provider before starting any new exercise program, 
especially if you have pre-existing health conditions.
```

## Therapeutic Language Patterns to Flag

### Always Flag (Critical)
| Pattern | Why |
|---|---|
| "cures", "heals", "treats" | Direct therapeutic claims |
| "prevents disease", "prevents [condition]" | Disease prevention claim |
| "clinically proven" (without citation) | Unsubstantiated efficacy claim |
| "FDA-approved" (when not true) | False regulatory claim |
| "prescription-strength" | Implies pharmaceutical equivalence |
| "replaces medication/therapy" | Discourages medical treatment |

### Flag for Review (Warning)
| Pattern | Why |
|---|---|
| "supports [organ] health" | Structure-function claim — needs disclaimer |
| "boosts immunity" | Vague health claim — needs context |
| "natural remedy" | Implies therapeutic use |
| "detox", "cleanse" | Implied health benefit — needs substantiation |
| "anti-inflammatory" (for food/supplement) | Implied drug-like property |
