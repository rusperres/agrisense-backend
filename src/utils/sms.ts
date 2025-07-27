// src/utils/sms.ts

import axios from 'axios';
import { SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME } from '../config/env';

/**
 * Sends an SMS message using the Semaphore API.
 *
 * @param to The recipient's phone number (e.g., "09123456789").
 * @param message The content of the SMS message.
 * @returns A Promise that resolves when the SMS is sent.
 */
export const sendSMS = async (to: string, message: string): Promise<void> => {
  if (!SEMAPHORE_API_KEY) {
    console.warn('[SMS Utility] SEMAPHORE_API_KEY is not set. SMS will not be sent.');
    return;
  }

  // Ensure the phone number starts with '0' for Philippine numbers
  let formattedTo = to;
  if (to.startsWith('+63')) {
    formattedTo = '0' + to.substring(3);
  } else if (!to.startsWith('0')) {
    // Attempt to prepend '0' if it looks like a Philippine number without it
    // This is a basic heuristic, more robust validation might be needed
    if (to.length === 10 && (to.startsWith('9') || to.startsWith('09'))) { // Assuming 10-digit number like 917xxxxxxx
        formattedTo = '0' + to;
    }
  }

  try {
    const response = await axios.post('https://semaphore.co/api/v4/messages', {
      apikey: SEMAPHORE_API_KEY,
      number: formattedTo,
      message: message,
      sendername: SEMAPHORE_SENDER_NAME, // Optional: your sender name
    });

    if (response.data && response.data.status === 'success') {
      console.log(`[SMS Utility] SMS sent successfully to ${formattedTo} via Semaphore.`);
    } else {
      console.error(`[SMS Utility] Failed to send SMS to ${formattedTo} via Semaphore. Response:`, response.data);
      throw new Error(`Semaphore SMS failed: ${JSON.stringify(response.data)}`);
    }
  } catch (error: any) {
    console.error(`[SMS Utility] Error sending SMS to ${formattedTo} via Semaphore: ${error.message}`);
    // Log the full error response from axios if available
    if (error.response) {
      console.error('Semaphore API Error Response Data:', error.response.data);
      console.error('Semaphore API Error Response Status:', error.response.status);
    }
    throw error;
  }
};