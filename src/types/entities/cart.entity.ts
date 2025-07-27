/**
 * Defines the structure of a single item as it's stored in the database within a cart.
 * It only references the product by its ID and stores the quantity.
 */
export interface CartItemEntity {
    id: string; // Unique ID for this specific cart item (e.g., if you're using an array of sub-documents)
    productId: string; // References the ProductEntity by its ID
    quantity: number;
    // You might also store `priceAtAddition` here if you need to lock in the price
    // at the time the item was added to the cart, independent of current product price.
    // priceAtAddition: number;
}

/**
 * Defines the structure of a user's cart as it's stored in the database.
 * Each user typically has one cart.
 */
export interface CartEntity {
    id: string; // The unique ID for the cart itself (e.g., primary key)
    userId: string; // References the UserEntity (who owns this cart)
    items: CartItemEntity[]; // An array of items in the cart
    createdAt: string; // Timestamp for when the cart was created
    updatedAt: string; // Timestamp for the last time the cart was updated
}