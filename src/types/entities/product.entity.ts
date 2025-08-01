import { DBLocation } from '../location';
import { ProductCondition } from '../enums';

export interface ProductEntity {
  id: string;
  seller_id: string;
  name: string;
  variety: string | null;
  quantity: number;
  unit: string;
  price: number;
  description: string | null;
  harvest_date: string;
  location: string | null;
  category: string;
  images: string[] | null;
  condition: ProductCondition | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
