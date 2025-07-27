import { SMSDirection } from '../enums';

export interface SMSEntity {
  id: number;
  user_id: number;
  message: string;
  direction: SMSDirection;
  timestamp?: string;
}
