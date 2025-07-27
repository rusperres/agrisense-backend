import { pool } from '../config/db'; // Your database connection
import { PriceAlertEntity } from '../types/entities/priceAlert.entity';
import { CreatePriceAlertDTO } from '../types/dtos/priceAlert.dto';

export class PriceAlertModel {
  private tableName = 'price_alerts'; // Ensure this matches your actual table name

  /**
   * Creates a new price alert in the database.
   * @param alertData The data for the new price alert.
   * @returns A Promise resolving to the created PriceAlertEntity.
   */
  public async create(alertData: CreatePriceAlertDTO): Promise<PriceAlertEntity> {
    const result = await pool.query(
      `INSERT INTO ${this.tableName} (user_id, crop_name, price_threshold, trigger_type, region, specification) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [alertData.user_id, alertData.crop_name, alertData.price_threshold, alertData.trigger_type, alertData.region || null, alertData.specification || null]
    );
    return result.rows[0];
  }

  /**
   * Finds all price alerts for a given crop name.
   * @param cropName The name of the crop to find alerts for.
   * @returns A Promise resolving to an array of PriceAlertEntity objects.
   */
  public async findByCropName(cropName: string): Promise<PriceAlertEntity[]> {
    const result = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE crop_name ILIKE $1`,
      [`%${cropName}%`] // Use ILIKE for case-insensitive search
    );
    return result.rows;
  }

  /**
   * Finds all price alerts in the database.
   * @returns A Promise resolving to an array of all PriceAlertEntity objects.
   */
  public async findAll(): Promise<PriceAlertEntity[]> {
    const result = await pool.query(`SELECT * FROM ${this.tableName}`);
    return result.rows;
  }

  /**
   * Deletes a price alert by its ID.
   * @param id The ID of the price alert to delete.
   * @returns A Promise resolving when the deletion is complete.
   */
  public async delete(id: number): Promise<void> {
    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
  }
}
