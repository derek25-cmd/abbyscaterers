'use server';

import { ai } from '../genkit';
import { z } from 'zod';

const CostingAnalysisInputSchema = z.object({
  trendData: z.array(z.object({
    date: z.string(),
    actualPercentage: z.number(),
    forecastPercentage: z.number(),
  })).describe('Daily costing percentage trend (actual vs forecast).'),
  topIngredients: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
  })).describe('Top ingredients used by quantity.'),
});
export type CostingAnalysisInput = z.infer<typeof CostingAnalysisInputSchema>;

const CostingAnalysisOutputSchema = z.object({
  summary: z.string().describe('A summary of the costing trend over the period.'),
  anomalies: z.array(z.string()).describe('Identified anomalies or significant deviations between forecast and actual.'),
  advice: z.array(z.string()).describe('Actionable advice to improve costing accuracy and efficiency.'),
  efficiencyRating: z.enum(['excellent', 'good', 'fair', 'poor']).describe('Rating of the costing efficiency.'),
});
export type CostingAnalysisOutput = z.infer<typeof CostingAnalysisOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateCostingAnalysisPrompt',
  input: { schema: CostingAnalysisInputSchema },
  output: { schema: CostingAnalysisOutputSchema },
  prompt: `You are a senior financial analyst for "Abby's Catersmart", a premium catering company in Tanzania.
Your goal is to analyze the costing trend data and provide insights on efficiency and accuracy.

Metrics to analyze:
- Trend Data: Daily actual vs forecast costing percentages. A lower percentage generally means higher profit margin, but consistency is key.
- Top Ingredients: These are the heavy hitters in terms of volume.

Instructions:
1. Provide a "summary" that highlights the overall trend (e.g., "Costing has been stable at 35% but showed a spike last week").
2. Identify "anomalies" where the actual costing percentage significantly exceeded the forecast or where there are unexplained spikes.
3. Provide 3-4 "advice" points focusing on:
    - How to bridge the gap between forecast and actual.
    - Potential waste reduction for top ingredients.
    - Procurement strategies if certain ingredients are consistently high in usage.
4. Set an "efficiencyRating" based on how close the actual is to the forecast and the overall margin level (Ideal catering costing is typically between 25-35%).

Be concise, professional, and use TZS as the currency context.`,
});

export const generateCostingAnalysisFlow = ai.defineFlow(
  {
    name: 'generateCostingAnalysisFlow',
    inputSchema: CostingAnalysisInputSchema,
    outputSchema: CostingAnalysisOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function generateCostingAnalysisAction(input: CostingAnalysisInput): Promise<CostingAnalysisOutput> {
  return await generateCostingAnalysisFlow(input);
}
