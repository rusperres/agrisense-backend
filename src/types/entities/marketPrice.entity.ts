import { MarketTrend } from '../enums';

export interface MarketPriceEntity {
  id: number;
  crop_name: string;
  category: string;
  region: string;
  price: number | null;
  unit: string;
  trend: MarketTrend;
  source: string;
  date: string;
  specification: string; 
}

// Use when inserting (no ID needed)
export interface NewMarketPrice {
  crop_name: string;
  category: string;
  region: string;
  price: number | null;
  unit: string;
  trend: MarketTrend;
  source: string;
  date: string;
  specification: string; 
}

export type UpdateMarketPrice = Partial<Omit<MarketPriceEntity, 'id'>>;