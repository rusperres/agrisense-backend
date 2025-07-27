import { TransactionStatus } from '../enums';

export interface TransactionEntity {
  id: number;
  product_id: number;
  buyer_id: number;
  seller_id: number;
  quantity: number;
  total_price: number;
  status: TransactionStatus;
  payment_method?: string | null;
  delivery_address?: string | null;
  created_at?: string;
}
