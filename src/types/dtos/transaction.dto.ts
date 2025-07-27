import { TransactionStatus } from '../enums';

export interface CreateTransactionDTO {
  product_id: number;
  buyer_id: number;
  seller_id: number;
  quantity: number;
  total_price: number;
  status?: TransactionStatus; // Optional, defaults to 'pending' in logic
  payment_method?: string | null;
  delivery_address?: string | null;
}

export interface UpdateTransactionDTO {
  status?: TransactionStatus;
  payment_method?: string | null;
  delivery_address?: string | null;
}
