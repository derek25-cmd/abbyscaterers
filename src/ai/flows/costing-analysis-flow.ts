'use server';

import { ai } from '../genkit';
import { z } from 'zod';

const CostingAnalysisInputSchema = z.object({
  trendData: z.array(z.object({
    date: z.string(),
    actualPercentage: z.number(),
    forecastPercentage: z.number(),
    income: z.number(),
    cost: z.number(),
  })).describe('Daily costing performance including income and actual cost.'),
  topIngredients: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    totalCost: z.number(),
  })).describe('Top ingredients used by quantity and their total cost.'),
  overallKPIs: z.object({
    totalIncome: z.number(),
    totalActualCost: z.number(),
    totalForecastCost: z.number(),
    overallActualPercentage: z.number(),
    overallForecastPercentage: z.number(),
  }).describe('Aggregated KPIs for the selected period.'),
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
  prompt: `You are a senior financial and culinary analyst for "Abby's Catersmart", a premium catering company in Tanzania.
Your goal is to analyze the costing trend data precisely based on what the user is seeing on their screens. Use the exact data points provided to generate accurate KPIs and insights.

Context & Data provided:
- Trend Data: Daily actual vs forecast costing percentages, along with income and actual cost.
- Top Ingredients: Heavy hitters in terms of volume and cost.
- Overall KPIs: The aggregated totals for the period (Total Income, Total Cost, Overall Percentages).

Instructions:
1. Provide a precise "summary" that highlights the overall trend referencing the exact overall KPIs (e.g., total income, overall actual vs forecast percentage). Ensure this directly reflects the inputted overallKPIs.
2. Identify "anomalies" where actual costing percentage significantly deviated from forecast, citing specific dates and exact financial figures from the Trend Data.
3. Provide "advice" points focusing on:
    - Bridging the gap between forecast and actual using exact numbers and percentages.
    - Check for the mostly used products in the 'Top Ingredients' list and suggest concrete, cost-effective culinary alternatives or portion-control strategies to improve margins.
    - Suggest specific procurement or waste reduction strategies for the highest cost or highest volume items.
    - Include other relevant performance KPIs drawn from the data.
4. Set an "efficiencyRating" based on how close the actual is to the forecast and the overall margin level (Ideal catering costing is typically between 25-35%).

Be highly accurate, precise, and professional. Ensure all numbers cited match the input data. Use TZS as the currency context.`,
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
