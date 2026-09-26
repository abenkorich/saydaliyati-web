// Standard USD per 1M tokens, verified against the linked OpenAI model pages 2026-09-26.
// Only explicitly listed snapshots inherit alias pricing; never guess prices for custom/fine-tuned models.
export const gptPricingPresets = [
  { model: "gpt-4.1-mini", snapshots: ["gpt-4.1-mini-2025-04-14"], inputRate: 0.4, cachedInputRate: 0.1, outputRate: 1.6 },
  { model: "gpt-4.1", snapshots: ["gpt-4.1-2025-04-14"], inputRate: 2, cachedInputRate: 0.5, outputRate: 8 },
  { model: "gpt-4.1-nano", snapshots: ["gpt-4.1-nano-2025-04-14"], inputRate: 0.1, cachedInputRate: 0.025, outputRate: 0.4 },
  { model: "gpt-4o-mini", snapshots: ["gpt-4o-mini-2024-07-18"], inputRate: 0.15, cachedInputRate: 0.075, outputRate: 0.6 },
  { model: "gpt-4o", snapshots: ["gpt-4o-2024-08-06", "gpt-4o-2024-11-20"], inputRate: 2.5, cachedInputRate: 1.25, outputRate: 10 },
].map((preset) => ({ ...preset, source: `https://developers.openai.com/api/docs/models/${preset.model}` }));

export function gptRates(model: string | null) {
  return gptPricingPresets.find((preset) => preset.model === model || preset.snapshots.includes(model ?? "")) ?? null;
}
