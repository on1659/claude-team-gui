import type { LLMProvider } from '../types/llm';
import type { TeamMember } from '../types/team';
import type { MeetingMode, CostEstimate } from '../types/messages';

export function estimateCost(
  participants: TeamMember[],
  mode: MeetingMode,
  provider: LLMProvider,
): CostEstimate {
  const models = provider.getModels();

  if (mode === 'quick') {
    const model = models.find(m => m.tier === 'medium')!;
    const inputTokens = 1700 + participants.length * 500;
    const outputTokens = participants.length * 400;
    return {
      inputTokens,
      outputTokens,
      cost:
        (inputTokens / 1_000_000) * model.inputCostPer1M +
        (outputTokens / 1_000_000) * model.outputCostPer1M,
    };
  }

  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;
  const breakdown: Record<string, { tokens: number; cost: number; model: string }> = {};

  for (const member of participants) {
    const model = models.find(m => m.tier === member.salary)!;
    const inputTokens = 1300;
    const outputTokens = 800;
    const memberCost =
      (inputTokens / 1_000_000) * model.inputCostPer1M +
      (outputTokens / 1_000_000) * model.outputCostPer1M;

    breakdown[member.id] = { tokens: inputTokens + outputTokens, cost: memberCost, model: model.id };
    totalInput += inputTokens;
    totalOutput += outputTokens;
    totalCost += memberCost;
  }

  return { inputTokens: totalInput, outputTokens: totalOutput, cost: totalCost, breakdown };
}
