export interface CreateConversationDTO {
  participants: number[];           // [sender_id, receiver_id]
  product_id?: number | null;       // Optional: for product-based conversations
}
