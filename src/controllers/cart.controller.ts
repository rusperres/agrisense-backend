import { Request, Response, NextFunction } from 'express';
import * as CartService from '../services/cart.service';
import { CartResponseDto, AddToCartRequestDto, UpdateCartItemQuantityRequestDto } from '../types/dtos/cart.dto';

export const fetchCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;

        const cart: CartResponseDto = await CartService.fetchCartByUserId(userId);
        res.status(200).json(cart);
    } catch (error) {
        next(error);
    }
};

export const addToCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { productId, quantity }: AddToCartRequestDto = req.body;
        const updatedCart: CartResponseDto = await CartService.addItemToCart(userId, productId, quantity);

        res.status(200).json(updatedCart);
    } catch (error) {
        next(error);
    }
};

export const removeCartItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const itemId = req.params.itemId;

        const updatedCart: CartResponseDto = await CartService.removeCartItemById(userId, itemId);

        res.status(200).json(updatedCart);
    } catch (error) {
        next(error);
    }
};

/**
 * Updates the quantity of a specific item in the authenticated user's cart.
 * PATCH /api/cart/update/:itemId
 */
export const updateCartItemQuantity = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const itemId = req.params.itemId;
        const { quantity }: UpdateCartItemQuantityRequestDto = req.body;

        const updatedCart: CartResponseDto = await CartService.updateCartItemQuantity(userId, itemId, quantity);

        res.status(200).json(updatedCart);
    } catch (error) {
        next(error);
    }
};

export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;

        const clearedCart: CartResponseDto = await CartService.clearUserCart(userId);

        res.status(200).json(clearedCart);
    } catch (error) {
        next(error);
    }
};

