import { z } from "zod";

export const dietaryClassificationSchema = z.object({
  restriction: z.string(),
  category: z.string(),
  isAmbiguous: z.boolean(),
});

export const clientSchema = z.object({
  id: z.string().uuid().optional(), // Optional for creation, will be generated
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  company: z.string().optional(),
  address: z.string().min(5, { message: "Address must be at least 5 characters." }),
  eventPreferences: z.string().optional(),
  dietaryRestrictionsRaw: z.string().optional(),
  dietaryClassifications: z.array(dietaryClassificationSchema).optional(),
  lastContacted: z.string().datetime({ message: "Invalid date format for last contacted." }),
  createdAt: z.string().datetime().optional(), // Optional for creation
  updatedAt: z.string().datetime().optional(), // Optional for creation
});

export type ClientFormData = z.infer<typeof clientSchema>;
