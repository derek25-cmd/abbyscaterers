
export interface DietaryClassification {
  restriction: string;
  category: string;
  isAmbiguous: boolean;
}

export interface Client {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  company?: string;
  address: string;
  eventPreferences: string;
  dietaryRestrictionsRaw: string;
  dietaryClassifications?: DietaryClassification[];
  lastContacted: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}
