import { Product } from "./product.dto";

export interface AddToCartRequestDto {
    productId: string;
    quantity: number; // Must be a positive integer
}

export interface UpdateCartItemQuantityRequestDto {
    quantity: number; // Must be a positive integer
}

export interface CartItemResponseDto {
    id: string;
    productId: string;
    product: Product;
    quantity: number;
    subtotal: number;
}

export interface CartResponseDto {
    items: CartItemResponseDto[];
    totalItems: number;
    totalAmount: number;
}