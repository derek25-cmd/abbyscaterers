
export interface DietaryClassification {
  restriction: string;
  category: string;
  isAmbiguous: boolean;
}

export interface Client {
  id: string;
  companyName: string;
  companyEmail: string;
  phoneNumber: string;
  address1: string;
  address2?: string;
  primaryLocation: string;
  lastContacted: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Equipment {
  id: string; // Internally used unique ID, typically equipmentNumber
  equipmentNumber: string; // User-facing "No."
  equipmentName: string;
  oem?: string;
  model?: string;
  powerRating?: string;
  quantity: number;
  yearOfManufacture?: string;
  equipmentSource?: string;
  capacity?: string;
  commitment?: string;
  registrationNumber?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}
