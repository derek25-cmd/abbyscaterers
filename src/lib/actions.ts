"use server";

import { classifyDietaryRestrictions as classifyDietaryRestrictionsFlow } from "@/ai/flows/classify-dietary-restrictions";
import type { ClassifyDietaryRestrictionsOutput } from "@/ai/flows/classify-dietary-restrictions";

export async function classifyDietaryRestrictionsAction(
  dietaryRestrictions: string
): Promise<ClassifyDietaryRestrictionsOutput | { error: string }> {
  if (!dietaryRestrictions.trim()) {
    return { classifications: [] };
  }
  try {
    const result = await classifyDietaryRestrictionsFlow({ dietaryRestrictions });
    return result;
  } catch (error) {
    console.error("Error in classifyDietaryRestrictionsAction:", error);
    return { error: "Failed to classify dietary restrictions." };
  }
}
