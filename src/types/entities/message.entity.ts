import { MessageType } from '../enums';

export interface MessageEntity {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: MessageType;
  is_read: boolean;
  created_at: string;
}

export interface ConversationEntity {
  id: string;
  participants: string[];
  product_name: string | null;
  product_id: string | null;
  last_message_id: string | null;
  created_at: string;
  updated_at: string;
}