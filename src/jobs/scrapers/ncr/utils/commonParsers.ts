import { MarketTrend } from '../../../../types/enums'; // Assuming MarketTrend is defined here

/**
 * Cleans and normalizes text: replaces multiple whitespace characters with a single space, then trims.
 */
export const cleanText = (text: string): string => {
  return text?.replace(/\s+/g, ' ').trim() || '';
};

/**
 * Converts raw price text to a number, handling "n/a", "$n/a", and "#DIV/0!" cases.
 */
export const parsePrice = (priceStr: string): number | null => {
  const cleaned = cleanText(priceStr);
  if (['n/a', '$n/a', '#n/a', '#div/0!'].includes(cleaned.toLowerCase())) return null;
  const numeric = parseFloat(cleaned.replace(/,/g, ''));
  return isNaN(numeric) ? null : numeric;
};

/**
 * Extracts the unit of measurement from a given text (specification or crop name).
 */
export const extractUnit = (text: string): string => {
  const t = text.toLowerCase();
  if (t.includes('/kg') || t.includes('per kg')) return 'P/kg';
  if (t.includes('/pc') || t.includes('per pc')) return 'P/pc';
  if (t.includes('/bottle')) return 'P/bottle';
  if (t.includes('/head')) return 'P/head';
  if (t.includes('/bunch')) return 'P/bunch';
  if (t.includes('ml/bottle')) return 'ml/bottle';
  if (t.includes('liter/bottle')) return 'Liter/bottle';
  if (t.includes('grams/pc') || t.includes('gm/pc')) return 'gm/pc';
  return 'P/unit';
};

// You can also define a simple validation function here if needed,
// but detailed validation will happen in structuredDataProcessor.ts
export const isValidMarketPriceItem = (item: any): boolean => {
  return typeof item.crop_name === 'string' && cleanText(item.crop_name).length > 0 &&
         typeof item.category === 'string' && cleanText(item.category).length > 0 &&
         (typeof item.price === 'number' || item.price === null) &&
         typeof item.unit === 'string' && cleanText(item.unit).length > 0;
};
