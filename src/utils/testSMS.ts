
import { sendSMS } from './sms';


const runTest = async () => {
  const recipientNumber = '09945795818'; // Replace with a real phone number for testing
  const testMessage = `Hello from AgriSense Backend! Current time: ${new Date().toLocaleString()}`;

  console.log(`Attempting to send SMS to: ${recipientNumber}`);
  console.log(`Message: "${testMessage}"`);

  if (!process.env.SEMAPHORE_API_KEY) {
    console.error('ERROR: SEMAPHORE_API_KEY is not set in your .env file.');
    console.error('Please make sure it\'s configured correctly before running this script.');
    return;
  }

  try {
    await sendSMS(recipientNumber, testMessage);
    console.log('\n--- SMS Test Script Completed ---');
    console.log('If no errors above, the SMS was likely sent successfully!');
    console.log('Check the recipient phone for the message.');
  } catch (error: any) {
    console.error('\n--- SMS Test Script Failed ---');
    console.error('Failed to send SMS:', error.message);
    if (error.response) {
      console.error('Semaphore API Response Data:', error.response.data);
      console.error('Semaphore API Response Status:', error.response.status);
    }
  }
};

runTest();