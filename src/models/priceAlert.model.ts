import { pool } from '../config/db';
import { PriceAlertEntity } from '../types/entities/priceAlert.entity';
import { CreatePriceAlertDTO } from '../types/dtos/priceAlert.dto';

export class PriceAlertModel {
  private tableName = 'price_alerts'; /
  public async create(alertData: CreatePriceAlertDTO): Promise<PriceAlertEntity> {
    const result = await pool.query(
      `INSERT INTO ${this.tableName} (user_id, crop_name, price_threshold, trigger_type, region, specification) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [alertData.user_id, alertData.crop_name, alertData.price_threshold, alertData.trigger_type, alertData.region || null, alertData.specification || null]
    );
    return result.rows[0];
  }


  public async findByCropName(cropName: string): Promise<PriceAlertEntity[]> {
    const result = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE crop_name ILIKE $1`,
      [`%${cropName}%`] 
    );
    return result.rows;
  }


  public async findAll(): Promise<PriceAlertEntity[]> {
    const result = await pool.query(`SELECT * FROM ${this.tableName}`);
    return result.rows;
  }


  public async delete(id: number): Promise<void> {
    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
  }
}
