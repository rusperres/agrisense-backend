// src/types/dtos/priceAlert.dto.ts

import { PriceAlertTriggerType } from '../enums'; // Import the enum

/**
 * DTO for creating a new price alert.
 * Defines the expected shape of the request body when a user subscribes to an alert.
 */
export interface CreatePriceAlertDTO {
  user_id: number;
  crop_name: string;
  price_threshold: number;
  trigger_type: PriceAlertTriggerType; // Use the enum for allowed values
  region?: string; // Optional: if alerts can be region-specific
  specification?: string; // Optional: if alerts can be specification-specific
}

/**
 * DTO for representing a price alert when retrieved (e.g., from a database).
 * Extends CreatePriceAlertDTO with an ID and optional created_at timestamp.
 */
export interface PriceAlertDTO extends CreatePriceAlertDTO {
    id: number;
    created_at?: string;
}

// You might also define DTOs for updating or filtering alerts if needed.
// export type UpdatePriceAlertDTO = Partial<Omit<CreatePriceAlertDTO, 'user_id'>>;
