'use server';
/**
 * @fileOverview Business Growth Insight AI agent.
 *
 * - generateBusinessInsight - A function that analyzes business metrics and provides growth advice.
 * - BusinessInsightInput - The input type for the analysis function.
 * - BusinessInsightOutput - The return type containing analysis and advice.
 */

import { ai } from '../genkit';
import { z } from 'zod';

const BusinessInsightInputSchema = z.object({
  revenueThisMonth: z.number().describe('Total revenue generated this month.'),
  revenueLastMonth: z.number().describe('Total revenue generated last month.'),
  outstandingInvoicesCount: z.number().describe('Number of invoices awaiting payment.'),
  outstandingAmount: z.number().describe('Total monetary value of outstanding invoices.'),
  topClientName: z.string().describe('Name of the highest revenue-generating client.'),
  upcomingEventsCount: z.number().describe('Number of events scheduled for the next 7 days.'),
  lowStockItemsCount: z.number().describe('Number of inventory items below their minimum threshold.'),
  attendanceRate: z.number().describe('Percentage of staff present today.'),
});
export type BusinessInsightInput = z.infer<typeof BusinessInsightInputSchema>;

const BusinessInsightOutputSchema = z.object({
  summary: z.string().describe('A factual summary of the business trend.'),
  advice: z.array(z.string()).describe('A list of actionable steps for the manager.'),
  growthIndicator: z.enum(['positive', 'neutral', 'warning']).describe('The overall business health status.'),
});
export type BusinessInsightOutput = z.infer<typeof BusinessInsightOutputSchema>;

export async function generateBusinessInsight(input: BusinessInsightInput): Promise<BusinessInsightOutput> {
  return generateBusinessInsightFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBusinessInsightPrompt',
  input: {schema: BusinessInsightInputSchema},
  output: {schema: BusinessInsightOutputSchema},
  prompt: `You are an expert business consultant for a premium catering company named "Abby's Catersmart" based in Tanzania.
Your goal is to provide a factual, professional, and actionable analysis of their current performance.

Use the following metrics to generate your insight:
- Revenue Trend: Comparing TZS {{revenueThisMonth}} (this month) vs TZS {{revenueLastMonth}} (last month).
- Cash Flow: {{outstandingInvoicesCount}} unpaid invoices totaling TZS {{outstandingAmount}}.
- Client Base: {{topClientName}} is currently the leading customer.
- Operations: {{upcomingEventsCount}} upcoming events, {{lowStockItemsCount}} inventory alerts, and {{attendanceRate}}% staff attendance.

Instructions:
1. Provide a "summary" that identifies the most critical trend (e.g., revenue growth, cash flow bottlenecks, or logistics risks).
2. Provide 3-4 "advice" bullet points. These should be specific (e.g., if stock is low, mention restocking; if cash flow is an issue, mention following up on specific amounts).
3. Set the "growthIndicator" based on whether revenue is up, cash flow is healthy, and operations are stable.

Be concise but professional. Use Tanzanian Shillings (TZS) as the currency context.`,
});

const generateBusinessInsightFlow = ai.defineFlow(
  {
    name: 'generateBusinessInsightFlow',
    inputSchema: BusinessInsightInputSchema,
    outputSchema: BusinessInsightOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
