export interface ConversationEntity {
  id: number;
  participants: number[];
  product_id?: number | null;
  updated_at?: string;
}
