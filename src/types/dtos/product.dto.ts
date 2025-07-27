import { ProductCondition } from '../enums';
import { Location } from './location.dto';

export interface CreateProductDTO {
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
  location: Location | null;
}

export interface UpdateProductDTO {
  name?: string;
  category?: string;
  price?: number;
  unit?: string;
  stock?: number;
  variety?: string | null;
  description?: string | null;
  images?: string[] | null;
  harvest_date?: string | null;
  condition?: ProductCondition | null;
  is_active?: boolean;
  location?: Location | null;
}

export interface Product {
    id:string
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
    location: Location | null; 
    created_at: string;
    updated_at: string;
}