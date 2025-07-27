import { PriceAlertEntity } from '../types/entities/priceAlert.entity';
import { CreatePriceAlertDTO } from '../types/dtos/priceAlert.dto';
import { PriceAlertModel } from '../models/priceAlert.model';
import { UserEntity } from '../types/entities/user.entity';
import { pool } from '../config/db';

export class PriceAlertService {
  private priceAlertModel: PriceAlertModel;

  constructor() {
    this.priceAlertModel = new PriceAlertModel();
  }

  /**
   * Creates a new price alert subscription.
   * @param alertData The data for the new price alert.
   * @returns A Promise resolving to the created PriceAlertEntity.
   */
  public async createPriceAlert(alertData: CreatePriceAlertDTO): Promise<PriceAlertEntity> {
    console.log(`[PriceAlert Service] Creating price alert for user ${alertData.user_id} on ${alertData.crop_name}.`);
    // Basic validation
    if (!alertData.user_id || !alertData.crop_name || alertData.price_threshold === undefined || !alertData.trigger_type) {
      throw new Error('Missing required fields for price alert (user_id, crop_name, price_threshold, trigger_type).');
    }
    try {
      const newAlert = await this.priceAlertModel.create(alertData);
      console.log(`[PriceAlert Service] Price alert created with ID: ${newAlert.id}`);
      return newAlert;
    } catch (error: any) {
      console.error(`[PriceAlert Service] Error creating price alert: ${error.message}`);
      throw new Error('Could not create price alert.');
    }
  }

  /**
   * Deletes an existing price alert subscription.
   * @param id The ID of the price alert to delete.
   * @returns A Promise resolving when the deletion is complete.
   */
  public async deletePriceAlert(id: number): Promise<void> {
    console.log(`[PriceAlert Service] Deleting price alert with ID: ${id}.`);
    try {
      await this.priceAlertModel.delete(id);
      console.log(`[PriceAlert Service] Price alert ID ${id} deleted successfully.`);
    } catch (error: any) {
      console.error(`[PriceAlert Service] Error deleting price alert ID ${id}: ${error.message}`);
      throw new Error('Could not delete price alert.');
    }
  }

  /**
   * Finds all price alerts for a given crop name.
   * This method is primarily used internally by the price alert processor.
   * @param cropName The name of the crop.
   * @returns A Promise resolving to an array of PriceAlertEntity objects.
   */
  public async getPriceAlertsByCropName(cropName: string): Promise<PriceAlertEntity[]> {
    try {
      const alerts = await this.priceAlertModel.findByCropName(cropName);
      return alerts;
    } catch (error: any) {
      console.error(`[PriceAlert Service] Error fetching price alerts for crop '${cropName}': ${error.message}`);
      throw new Error('Could not retrieve price alerts by crop name.');
    }
  }

  /**
   * Retrieves all price alerts from the database.
   * This is useful for processing all alerts in a batch.
   * @returns A Promise resolving to an array of all PriceAlertEntity objects.
   */
  public async getAllPriceAlerts(): Promise<PriceAlertEntity[]> {
    try {
      const alerts = await this.priceAlertModel.findAll(); // Assuming you'll add this to priceAlert.model.ts
      return alerts;
    } catch (error: any) {
      console.error(`[PriceAlert Service] Error fetching all price alerts: ${error.message}`);
      throw new Error('Could not retrieve all price alerts.');
    }
  }

  /**
   * Retrieves a user's phone number by their user ID.
   * This is a placeholder and assumes your User model/service can fetch this.
   * You might need to adjust this based on your actual user service implementation.
   * @param userId The ID of the user.
   * @returns A Promise resolving to the user's phone number or null if not found.
   */
  public async getUserPhoneNumber(userId: number): Promise<string | null> {
    try {
      const result = await pool.query('SELECT phone_number FROM users WHERE id = $1', [userId]);
      const user: UserEntity | null = result.rows[0] || null;
      return user ? user.phone ?? null : null;
    } catch (error: any) {
      console.error(`[PriceAlert Service] Error fetching phone number for user ${userId}: ${error.message}`);
      return null;
    }
  }

}
