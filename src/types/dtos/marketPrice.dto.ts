import { MarketTrend } from '../enums';

export interface CreateMarketPriceDTO {
  crop_name: string;
  category: string;
  region: string;
  price: number;
  unit: string;
  trend: MarketTrend;
  source: string;
  date: string;
}
