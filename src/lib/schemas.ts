
import { z } from "zod";

// This schema can remain if other parts of the app use it,
// but it's no longer directly part of the Client schema.
export const dietaryClassificationSchema = z.object({
  restriction: z.string(),
  category: z.string(),
  isAmbiguous: z.boolean(),
});

export const clientSchema = z.object({
  id: z.string().min(1, { message: "Client ID is required." }), 
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  companyEmail: z.string().email({ message: "Invalid company email address." }),
  phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  address1: z.string().min(5, { message: "Address 1 must be at least 5 characters." }),
  address2: z.string().optional(),
  primaryLocation: z.string().min(2, { message: "Primary location must be at least 2 characters." }),
  lastContacted: z.string().datetime({ message: "Invalid date format for last contacted." }),
  createdAt: z.string().datetime().optional(), // Optional for creation
  updatedAt: z.string().datetime().optional(), // Optional for creation
});

export type ClientFormData = z.infer<typeof clientSchema>;
