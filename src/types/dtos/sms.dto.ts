import { SMSDirection } from '../enums';

export interface CreateSMSDTO {
  user_id: number;
  message: string;
  direction: SMSDirection;
  timestamp?: string; // Optional: backend can auto-fill if not provided
}
