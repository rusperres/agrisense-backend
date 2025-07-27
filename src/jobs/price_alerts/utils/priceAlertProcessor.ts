// src/utils/priceAlertProcessor.ts

import { format, subDays } from 'date-fns';
import { MarketPriceEntity } from '../../../types/entities/marketPrice.entity';
import { findMarketPricesByDate, findLatestMarketPriceByCrop, findHistoricalMarketPricesByCrop } from '../../../models/marketPrice.model';
import { PriceAlertService } from '../../../services/priceAlert.service';
import { SmsService } from '../../../services/sms.service';
import { PriceAlertTriggerType } from '../../../types/enums'; // Import the enum

const priceAlertService = new PriceAlertService();
const smsService = new SmsService();

/**
 * Processes newly scraped market price data, compares it with previous data,
 * and triggers consolidated price alerts for subscribed users if changes are detected.
 *
 * @param newMarketPrices An array of the newly scraped and saved market price data.
 */
export const processMarketPriceChanges = async (newMarketPrices: MarketPriceEntity[]): Promise<void> => {
  console.log('[PriceAlertProcessor] Starting to process market price changes for alerts...');

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Map to store price changes detected for each crop-region-specification combination
  const changedCrops = new Map<string, { current: MarketPriceEntity; previous: MarketPriceEntity; message: string }>();

  // Group new prices by a unique key (crop_name, region, specification) for easier lookup
  const newPricesMap = new Map<string, MarketPriceEntity>();
  newMarketPrices.forEach(price => {
    const key = `${price.crop_name.toLowerCase()}-${price.region.toLowerCase()}-${price.specification?.toLowerCase() || ''}`;
    newPricesMap.set(key, price);
  });

  for (const [key, currentPriceData] of newPricesMap.entries()) {
    let previousPrice: MarketPriceEntity | null = null;

    // 1a. If the product existed the day before, then the day before is its previous version.
    const yesterdayPrices = await findMarketPricesByDate(
      yesterday,
      currentPriceData.region,
      currentPriceData.crop_name,
      currentPriceData.specification
    );

    if (yesterdayPrices.length > 0) {
      // If multiple entries for yesterday, pick the one matching specification precisely
      previousPrice = yesterdayPrices.find(p => p.specification === currentPriceData.specification) || yesterdayPrices[0];
      console.log(`[PriceAlertProcessor] Found yesterday's price for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}) in ${currentPriceData.region}: ${previousPrice.price}`);
    }

    // 1b. If the product did not exist the day before, then the last day it existed is its previous version.
    if (!previousPrice) {
      console.log(`[PriceAlertProcessor] No price found for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}) for yesterday (${yesterday}). Checking historical data...`);
      // Find historical prices for this specific crop and specification
      const historicalPrices = await findHistoricalMarketPricesByCrop(currentPriceData.crop_name, 180, currentPriceData.specification); // 180 days ~ 6 months
      if (historicalPrices.length > 0) {
        // historicalPrices are ordered by date DESC, so the first one is the most recent
        previousPrice = historicalPrices[0];
        if (previousPrice) {
            console.log(`[PriceAlertProcessor] Found historical price for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}) from ${previousPrice.date}: ${previousPrice.price}`);
        }
      }
    }

    // 1c. If a product never existed at all, then no user would be alerted.
    if (!previousPrice) {
      console.log(`[PriceAlertProcessor] No previous or historical price found for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}). Skipping price alert check.`);
      continue;
    }

    // Compare prices (ensure both are not null for comparison)
    if (currentPriceData.price !== null && previousPrice.price !== null && currentPriceData.price !== previousPrice.price) {
      let message = '';
      if (currentPriceData.price > previousPrice.price) {
        message = `increased from ${previousPrice.price} to ${currentPriceData.price}`;
      } else {
        message = `decreased from ${previousPrice.price} to ${currentPriceData.price}`;
      }
      console.log(`[PriceAlertProcessor] Price change detected for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}): ${message}`);
      changedCrops.set(key, { current: currentPriceData, previous: previousPrice, message });
    } else {
      console.log(`[PriceAlertProcessor] No significant price change for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}). Current: ${currentPriceData.price}, Previous: ${previousPrice?.price}`);
    }
  }

  // If no crops changed price, exit
  if (changedCrops.size === 0) {
      console.log('[PriceAlertProcessor] No crop prices changed. No alerts to send.');
      return;
  }

  // Group alerts by user_id
  const userAlertMessages = new Map<number, string[]>();

  // Iterate through all price alerts to find relevant ones for changed crops
  const allPriceAlerts = await priceAlertService.getAllPriceAlerts();
  console.log(`[PriceAlertProcessor] Found ${allPriceAlerts.length} total price alerts.`);

  for (const alert of allPriceAlerts) {
    // Construct a key for the alert that matches the changedCrops map key
    const alertKey = `${alert.crop_name.toLowerCase()}-${alert.region?.toLowerCase() || ''}-${alert.specification?.toLowerCase() || ''}`;
    const changedCrop = changedCrops.get(alertKey);

    if (changedCrop) {
      const { current, previous, message } = changedCrop;
      const currentPriceValue = current.price;
      const previousPriceValue = previous.price;
      const threshold = alert.price_threshold;

      // Re-evaluate alert condition based on trigger_type and threshold
      let shouldAlert = false;
      if (currentPriceValue !== null && previousPriceValue !== null) {
        if (alert.trigger_type === PriceAlertTriggerType.Above && currentPriceValue > previousPriceValue && currentPriceValue >= threshold) {
          shouldAlert = true;
        } else if (alert.trigger_type === PriceAlertTriggerType.Below && currentPriceValue < previousPriceValue && currentPriceValue <= threshold) {
          shouldAlert = true;
        } else if (alert.trigger_type === PriceAlertTriggerType.Changed && currentPriceValue !== previousPriceValue) {
          // For 'changed' type, the initial check (currentPriceData.price !== previousPrice.price) is sufficient
          shouldAlert = true;
        }
      }

      if (shouldAlert) {
        const alertMessage = `The price of ${alert.crop_name} (${alert.specification || 'N/A'}) in ${current.region} has ${message}. New price: ${current.price} ${current.unit}.`;
        if (!userAlertMessages.has(alert.user_id)) {
          userAlertMessages.set(alert.user_id, []);
        }
        userAlertMessages.get(alert.user_id)?.push(alertMessage);
      }
    }
  }

  // Send consolidated SMS to each user
  for (const [userId, messages] of userAlertMessages.entries()) {
    const userPhoneNumber = await priceAlertService.getUserPhoneNumber(userId);
    if (userPhoneNumber && messages.length > 0) {
      const consolidatedMessage = `AgriSense Daily Price Alert:\n${messages.join('\n')}`;
      console.log(`[PriceAlertProcessor] Sending consolidated SMS to user ${userId} (${userPhoneNumber}).`);
      try {
        await smsService.sendSMS(userPhoneNumber, consolidatedMessage);
        console.log(`[PriceAlertProcessor] Consolidated SMS sent successfully to user ${userId}.`);
      } catch (error) {
        console.error(`[PriceAlertProcessor] Failed to send consolidated SMS to user ${userId}:`, error);
      }
    }
  }
  console.log('[PriceAlertProcessor] Finished processing market price changes for alerts.');
};
