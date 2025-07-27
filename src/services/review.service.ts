import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { CreateReviewRequestDTO, ReviewResponseDTO, GetReviewsQueryDTO } from '../types/dtos/review.dto';
import { ReviewEntity } from '../types/entities/review.entity';
import { OrderStatus } from '../types/enums';

// Helper function to convert DB entity to DTO for response
const mapReviewEntityToReviewResponseDTO = (entity: ReviewEntity): ReviewResponseDTO => {
    return {
        id: entity.id,
        orderId: entity.orderId,
        productId: entity.productId,
        productName: entity.productName,
        buyerId: entity.buyerId,
        sellerId: entity.sellerId,
        sellerName: entity.sellerName,
        rating: entity.rating,
        comment: entity.comment,
        createdAt: entity.createdAt.toISOString(),
    };
};

/**
 * @function createReview
 * @description Creates a new review in the database.
 * Includes important checks:
 * 1. Order must exist.
 * 2. Order status must be 'delivered'.
 * 3. The specific order item must not have been reviewed already.
 * 4. Extracts product and seller names based on the provided IDs.
 * @param reviewData The data for the new review.
 * @returns The newly created review as a ReviewResponseDTO.
 */
export const createReview = async (reviewData: CreateReviewRequestDTO): Promise<ReviewResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Verify the order exists and is delivered
        const orderQueryResult = await client.query(
            `SELECT id, product_id, product_name, buyer_id, seller_id, seller_name, status, can_review
       FROM orders
       WHERE id = $1 AND buyer_id = $2;`,
            [reviewData.orderId, reviewData.buyerId]
        );

        const order = orderQueryResult.rows[0];

        if (!order) {
            throw new Error('Order not found or does not belong to the buyer.');
        }
        if (order.status !== OrderStatus.Delivered) {
            throw new Error(`Cannot submit review: Order status is "${order.status}", but must be "${OrderStatus.Delivered}".`);
        }
        if (order.product_id !== reviewData.productId) {
            throw new Error('Product ID in review does not match product in order.');
        }
        if (order.can_review === false) {
            throw new Error('This order has already been reviewed or cannot be reviewed.');
        }


        // 2. Insert the new review
        const insertReviewResult = await client.query<ReviewEntity>(
            `INSERT INTO reviews (
        order_id, product_id, product_name, buyer_id, seller_id, seller_name, rating, comment, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *;`,
            [
                reviewData.orderId,
                reviewData.productId,
                order.product_name,
                reviewData.buyerId,
                order.seller_id,
                order.seller_name,
                reviewData.rating,
                reviewData.comment,
            ]
        );
        const newReviewEntity = insertReviewResult.rows[0];

        // 3. Update the order to mark it as reviewed (optional, but good practice for 'canReview' flag)
        await client.query(
            `UPDATE orders SET can_review = FALSE, updated_at = NOW() WHERE id = $1;`,
            [reviewData.orderId]
        );

        await client.query('COMMIT');

        return mapReviewEntityToReviewResponseDTO(newReviewEntity);
    } catch (error: any) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Service error creating review:', error);
        throw new Error(error.message || 'Failed to submit review.');
    } finally {
        if (client) client.release();
    }
};


/**
 * @function getReviews
 * @description Fetches reviews from the database based on provided query parameters.
 * @param queryParams Filters for reviews (productId, sellerId, orderId).
 * @returns An array of ReviewResponseDTOs.
 */
export const getReviews = async (queryParams: GetReviewsQueryDTO): Promise<ReviewResponseDTO[]> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const { productId, sellerId, orderId } = queryParams;
        const conditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (productId) {
            conditions.push(`product_id = $${paramIndex++}`);
            values.push(productId);
        }
        if (sellerId) {
            conditions.push(`seller_id = $${paramIndex++}`);
            values.push(sellerId);
        }
        if (orderId) {
            conditions.push(`order_id = $${paramIndex++}`);
            values.push(orderId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `SELECT * FROM reviews ${whereClause} ORDER BY created_at DESC;`;

        const result = await client.query<ReviewEntity>(query, values);

        return result.rows.map(mapReviewEntityToReviewResponseDTO);
    } catch (error: any) {
        console.error('Service error fetching reviews:', error);
        throw new Error(error.message || 'Failed to fetch reviews.');
    } finally {
        if (client) client.release();
    }
};