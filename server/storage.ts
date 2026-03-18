// No database needed for this app - all data is computed in stockData.ts
export interface IStorage {}
export class MemStorage implements IStorage {}
export const storage = new MemStorage();
