
/**
 * @interface ReviewEntity
 * @description Represents the structure of a review as stored in the database.
 * Includes timestamps for creation and last update.
 */
export interface ReviewEntity {
  id: string; // Unique identifier for the review (e.g., UUID)
  orderId: string; // ID of the order this review is associated with
  productId: string; // ID of the product being reviewed
  productName: string; // Denormalized product name for convenience
  buyerId: string; // ID of the buyer who submitted the review
  sellerId: string; // ID of the seller whose product is being reviewed
  sellerName: string; // Denormalized seller name for convenience
  rating: number; // Rating given by the buyer (e.g., 1-5 stars)
  comment: string; // Text comment provided by the buyer
  createdAt: Date; // Timestamp when the review was created
  updatedAt: Date; // Timestamp when the review was last updated
}