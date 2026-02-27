import { format, subDays } from 'date-fns';
import { MarketPriceEntity } from '../../../types/entities/marketPrice.entity';
import { findMarketPricesByDate, findLatestMarketPriceByCrop, findHistoricalMarketPricesByCrop } from '../../../models/marketPrice.model';
import { PriceAlertService } from '../../../services/priceAlert.service';
import { SmsService } from '../../../services/sms.service';
import { PriceAlertTriggerType } from '../../../types/enums'; // Import the enum

const priceAlertService = new PriceAlertService();
const smsService = new SmsService();

export const processMarketPriceChanges = async (newMarketPrices: MarketPriceEntity[]): Promise<void> => {
  console.log('[PriceAlertProcessor] Starting to process market price changes for alerts...');

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const changedCrops = new Map<string, { current: MarketPriceEntity; previous: MarketPriceEntity; message: string }>();

  const newPricesMap = new Map<string, MarketPriceEntity>();
  newMarketPrices.forEach(price => {
    const key = `${price.crop_name.toLowerCase()}-${price.region.toLowerCase()}-${price.specification?.toLowerCase() || ''}`;
    newPricesMap.set(key, price);
  });

  for (const [key, currentPriceData] of newPricesMap.entries()) {
    let previousPrice: MarketPriceEntity | null = null;

    const yesterdayPrices = await findMarketPricesByDate(
      yesterday,
      currentPriceData.region,
      currentPriceData.crop_name,
      currentPriceData.specification
    );

    if (yesterdayPrices.length > 0) {
      previousPrice = yesterdayPrices.find(p => p.specification === currentPriceData.specification) || yesterdayPrices[0];
      console.log(`[PriceAlertProcessor] Found yesterday's price for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}) in ${currentPriceData.region}: ${previousPrice.price}`);
    }

    if (!previousPrice) {
      console.log(`[PriceAlertProcessor] No price found for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}) for yesterday (${yesterday}). Checking historical data...`);
      const historicalPrices = await findHistoricalMarketPricesByCrop(currentPriceData.crop_name, 180, currentPriceData.specification); // 180 days ~ 6 months
      if (historicalPrices.length > 0) {
        previousPrice = historicalPrices[0];
        if (previousPrice) {
            console.log(`[PriceAlertProcessor] Found historical price for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}) from ${previousPrice.date}: ${previousPrice.price}`);
        }
      }
    }

    if (!previousPrice) {
      console.log(`[PriceAlertProcessor] No previous or historical price found for ${currentPriceData.crop_name} (${currentPriceData.specification || 'N/A'}). Skipping price alert check.`);
      continue;
    }

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

  if (changedCrops.size === 0) {
      console.log('[PriceAlertProcessor] No crop prices changed. No alerts to send.');
      return;
  }

  const userAlertMessages = new Map<number, string[]>();

  const allPriceAlerts = await priceAlertService.getAllPriceAlerts();
  console.log(`[PriceAlertProcessor] Found ${allPriceAlerts.length} total price alerts.`);

  for (const alert of allPriceAlerts) {
    const alertKey = `${alert.crop_name.toLowerCase()}-${alert.region?.toLowerCase() || ''}-${alert.specification?.toLowerCase() || ''}`;
    const changedCrop = changedCrops.get(alertKey);

    if (changedCrop) {
      const { current, previous, message } = changedCrop;
      const currentPriceValue = current.price;
      const previousPriceValue = previous.price;
      const threshold = alert.price_threshold;

      let shouldAlert = false;
      if (currentPriceValue !== null && previousPriceValue !== null) {
        if (alert.trigger_type === PriceAlertTriggerType.Above && currentPriceValue > previousPriceValue && currentPriceValue >= threshold) {
          shouldAlert = true;
        } else if (alert.trigger_type === PriceAlertTriggerType.Below && currentPriceValue < previousPriceValue && currentPriceValue <= threshold) {
          shouldAlert = true;
        } else if (alert.trigger_type === PriceAlertTriggerType.Changed && currentPriceValue !== previousPriceValue) {
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
