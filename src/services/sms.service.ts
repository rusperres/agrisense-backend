// src/services/sms.service.ts

import { sendSMS as sendSmsUtil } from '../utils/sms'; // Import the utility function

export class SmsService {
  /**
   * Sends an SMS message. This service acts as a wrapper around the utility
   * function, allowing for potential additional business logic, logging,
   * or error handling specific to SMS operations.
   *
   * @param to The recipient's phone number.
   * @param message The content of the SMS message.
   * @returns A Promise that resolves when the SMS is sent.
   */
  public async sendSMS(to: string, message: string): Promise<void> {
    console.log(`[SMS Service] Preparing to send SMS to ${to}.`);
    try {
      await sendSmsUtil(to, message);
      console.log(`[SMS Service] SMS operation completed for ${to}.`);
    } catch (error: any) {
      console.error(`[SMS Service] Failed to send SMS via service to ${to}: ${error.message}`);
      throw error;
    }
  }
}
