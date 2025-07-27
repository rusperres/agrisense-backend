import { DBLocation } from '../location';
import { ProductCondition } from '../enums';

export interface ProductEntity {
  id: string;
  seller_id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  variety: string | null;
  description: string | null;
  images: string[] | null;
  harvest_date: string | null;
  condition: ProductCondition | null;
  is_active: boolean;
  location: DBLocation | null;
  created_at: string;
  updated_at: string;
}
