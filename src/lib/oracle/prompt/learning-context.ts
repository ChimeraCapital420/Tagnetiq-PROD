// FILE: src/lib/oracle/prompt/learning-context.ts
// Builds learning mode prompt blocks when Oracle shifts to teacher mode
// Triggered by: "teach me about X", "how do I spot fakes", learning chips

export function buildLearningPrompt(params: {
  topic: string;
  mode: 'category_deep_dive' | 'market_lesson' | 'negotiation_drill' | 'authentication_101' | 'general';
  currentStep?: number;
  totalSteps?: number;
  previousAnswers?: string[];
  expertiseLevel?: string;
}): string {
  const { topic, mode, currentStep, totalSteps, previousAnswers, expertiseLevel } = params;

  const difficultyGuide = expertiseLevel === 'expert' ? 'advanced' :
    expertiseLevel === 'advanced' ? 'intermediate-to-advanced' :
    expertiseLevel === 'intermediate' ? 'intermediate' : 'beginner-friendly';

  const modeGuides: Record<string, string> = {
    category_deep_dive: `You are teaching a structured mini-course about ${topic}.
Create engaging, practical lessons that build on each other.
Each step should include:
1. A clear, memorable concept or technique
2. A real-world example from the resale world
3. A hands-on challenge question to test understanding
Focus on what makes money — pricing signals, condition tells, authentication shortcuts, and sourcing strategies.`,

    market_lesson: `You are explaining how the ${topic} market works.
Cover: supply/demand dynamics, seasonal patterns, grading impact on value, where to buy/sell, common pitfalls.
Use specific price examples and recent market trends.
Make it actionable — what should the user DO with this knowledge?`,

    negotiation_drill: `You are running a negotiation practice session about ${topic}.
Play the role of a seller/buyer and let the user practice.
After each round, give feedback:
- What they did well
- What they could improve
- Advanced techniques to try next
Make it feel like a real conversation, not a textbook exercise.`,

    authentication_101: `You are teaching how to authenticate ${topic}.
Cover the most common fakes and how to spot them:
- Visual tells (stitching, materials, labels, printing)
- Weight/feel differences
- Serial number verification
- Where to get professional authentication
- Red flags in online listings
Use specific examples with clear "look for THIS" instructions.`,

    general: `You are teaching about ${topic} in an engaging, practical way.
Break it down into clear steps. Use examples from the resale world when possible.
Make each step build on the last. Include a challenge or quiz at the end.`,
  };

  const sections = [modeGuides[mode] || modeGuides.general];

  sections.push(`\nDifficulty: ${difficultyGuide}`);

  if (currentStep && totalSteps) {
    sections.push(`\nThis is step ${currentStep} of ${totalSteps}. Build on what came before.`);
  }

  if (previousAnswers?.length) {
    sections.push(`\nUser's previous answers: ${previousAnswers.slice(-3).join(' | ')}`);
    sections.push('Acknowledge their progress and adjust difficulty based on their understanding.');
  }

  sections.push(`
## RESPONSE FORMAT:
{
  "stepNumber": ${currentStep || 1},
  "totalSteps": ${totalSteps || 5},
  "title": "Short step title",
  "content": "The lesson content (2-3 paragraphs, engaging and practical)",
  "challenge": "A question or task to test understanding (optional)",
  "hint": "A hint for the challenge (optional)",
  "funFact": "An interesting related fact (optional)"
}`);

  return sections.join('\n');
}
