import type { Client } from '../types';

export declare function useClientStorage(): {
  getClientById: (id: string) => Client | undefined;
  isLoading: boolean;
};
