# AI Detection Patterns

Common patterns that AI-detection tools identify in AI-generated text. The content humanizer must recognize and eliminate these markers.

## Uniform Sentence Length

AI-generated text tends to produce sentences of similar length (typically 15-25 words). Human writing naturally varies between very short punchy sentences (3-8 words) and longer complex ones (25-40 words).

**Detection signal:** Standard deviation of sentence length below 5 words across a paragraph.

## Hedge-Word Clusters

AI models frequently insert hedging language to appear balanced:
- "It's important to note that..."
- "While there are many factors to consider..."
- "One might argue that..."
- "It should be noted that..."

**Detection signal:** More than 2 hedge phrases per 200 words.

## Passive Voice Overuse

AI models default to passive constructions more often than human writers:
- "It can be seen that..." → "You'll notice..."
- "The product was designed to..." → "We designed the product to..."
- "Results were observed..." → "We saw results..."

**Detection signal:** Passive voice in more than 20% of sentences.

## Transition-Word Density

AI text uses an unnaturally high density of formal transition words:
- Furthermore, Moreover, Additionally, Consequently
- In addition, As a result, Nevertheless, However
- It is worth mentioning, In light of this

**Detection signal:** More than 3 formal transition words per 200 words.

## Predictable Paragraph Structure

AI-generated paragraphs often follow a rigid pattern:
1. Topic sentence
2. Supporting detail
3. Example or elaboration
4. Concluding/transitional sentence

Human writing is messier — paragraphs vary from 1 to 8+ sentences, some start with examples, others end abruptly.

**Detection signal:** All paragraphs within 1 sentence of the same length.

## Common AI Phrases (High-Confidence Markers)

These phrases almost never appear in natural human writing:

### Generic Openers
- "In today's digital landscape"
- "In the ever-evolving world of"
- "In the realm of"
- "In an era where"

### Filler Transitions
- "It's important to note"
- "It is worth mentioning"
- "This is particularly relevant because"
- "Let's explore"
- "Let's dive in"

### Corporate Buzzwords
- "Unlock the power"
- "Harness the potential"
- "Leverage the"
- "Seamlessly integrate"
- "Groundbreaking solution"

### ChatGPT-isms
- "Delve into"
- "Embark on a journey"
- "Tapestry of"
- "Bustling"
- "Navigate the complexities"
- "Fostering innovation"
- "Pivotal moment"

## Vocabulary Uniformity

AI text tends to use the same register throughout. Human writers naturally shift between formal and informal, technical and colloquial within the same piece.

**Detection signal:** Vocabulary register remains constant across 500+ words.

## Lack of Personal Voice

AI-generated content rarely includes:
- First-person opinions ("I think...", "Honestly...")
- Rhetorical questions
- Sentence fragments used for emphasis
- Colloquialisms and slang
- Self-corrections or asides

**Detection signal:** Zero first-person pronouns or opinion markers in 300+ words.
