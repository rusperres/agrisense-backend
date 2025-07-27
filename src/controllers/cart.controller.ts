import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/express';
import * as CartService from '../services/cart.service';
import { CartResponseDto, AddToCartRequestDto, UpdateCartItemQuantityRequestDto } from '../types/dtos/cart.dto';

export const fetchCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;

        const cart: CartResponseDto = await CartService.fetchCartByUserId(userId);
        res.status(200).json(cart);
    } catch (error) {
        next(error);
    }
};

export const addToCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id; // User ID from authentication
        const { productId, quantity }: AddToCartRequestDto = req.body; // Destructure validated body

        // Call the service to add the item to the cart
        const updatedCart: CartResponseDto = await CartService.addItemToCart(userId, productId, quantity);

        // Respond with 200 OK and the updated cart data
        res.status(200).json(updatedCart);
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

export const removeCartItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id; // User ID from authentication
        const itemId = req.params.itemId; // Cart item ID from URL parameters

        // Call the service to remove the item from the cart
        const updatedCart: CartResponseDto = await CartService.removeCartItemById(userId, itemId);

        // Respond with 200 OK and the updated cart data
        res.status(200).json(updatedCart);
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

/**
 * Updates the quantity of a specific item in the authenticated user's cart.
 * PATCH /api/cart/update/:itemId
 */
export const updateCartItemQuantity = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id; // User ID from authentication
        const itemId = req.params.itemId; // Cart item ID from URL parameters
        const { quantity }: UpdateCartItemQuantityRequestDto = req.body; // New quantity from validated body

        // Call the service to update the item's quantity
        const updatedCart: CartResponseDto = await CartService.updateCartItemQuantity(userId, itemId, quantity);

        // Respond with 200 OK and the updated cart data
        res.status(200).json(updatedCart);
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

export const clearCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id; // User ID from authentication

        // Call the service to clear the user's cart
        const clearedCart: CartResponseDto = await CartService.clearUserCart(userId);

        // Respond with 200 OK and the empty cart data
        res.status(200).json(clearedCart);
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};
// Placeholder for other cart controller functions
/*
export const clearCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { ... };
*/

