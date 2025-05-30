'use server';

/**
 * @fileOverview A dietary restriction classification AI agent.
 *
 * - classifyDietaryRestrictions - A function that handles the dietary restriction classification process.
 * - ClassifyDietaryRestrictionsInput - The input type for the classifyDietaryRestrictions function.
 * - ClassifyDietaryRestrictionsOutput - The return type for the classifyDietaryRestrictions function.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const ClassifyDietaryRestrictionsInputSchema = z.object({
  dietaryRestrictions: z
    .string()
    .describe('The dietary restrictions provided by the client.'),
});
export type ClassifyDietaryRestrictionsInput = z.infer<typeof ClassifyDietaryRestrictionsInputSchema>;

const ClassifyDietaryRestrictionsOutputSchema = z.object({
  classifications: z.array(
    z.object({
      restriction: z.string().describe('The dietary restriction.'),
      category: z.string().describe('The classified category of the restriction.'),
      isAmbiguous: z.boolean().describe('Whether the restriction is ambiguous or unclear.'),
    })
  ).describe('The list of dietary restrictions classifications.'),
});
export type ClassifyDietaryRestrictionsOutput = z.infer<typeof ClassifyDietaryRestrictionsOutputSchema>;

export async function classifyDietaryRestrictions(
  input: ClassifyDietaryRestrictionsInput
): Promise<ClassifyDietaryRestrictionsOutput> {
  return classifyDietaryRestrictionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'classifyDietaryRestrictionsPrompt',
  input: {schema: ClassifyDietaryRestrictionsInputSchema},
  output: {schema: ClassifyDietaryRestrictionsOutputSchema},
  prompt: `You are an expert in dietary restrictions and allergies.

You will receive a list of dietary restrictions provided by a client. You will classify each restriction into a category, and determine if the restriction is ambiguous or unclear.

Categories may include, but are not limited to: Vegan, Vegetarian, Gluten-Free, Dairy-Free, Nut-Free, Shellfish-Free, Soy-Free, Kosher, Halal, Diabetic, Low-Sodium, Low-Fat, Paleo, Whole30.

Ambiguous or unclear responses should be flagged for manual review. Examples of ambiguous responses include: "No red meat", "Healthy", "Just be careful".

Dietary Restrictions: {{{dietaryRestrictions}}}`,
});

const classifyDietaryRestrictionsFlow = ai.defineFlow(
  {
    name: 'classifyDietaryRestrictionsFlow',
    inputSchema: ClassifyDietaryRestrictionsInputSchema,
    outputSchema: ClassifyDietaryRestrictionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
