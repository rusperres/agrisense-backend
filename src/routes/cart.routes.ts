import { Router } from 'express';
import * as CartController from '../controllers/cart.controller';
import { authenticateUser } from '../middlewares/auth.middleware';
import { validateAddToCart, validateRemoveCartItem, validateUpdateCartItemQuantity } from '../middlewares/validate.middleware';

const router = Router();

router.get(
    '/',
    authenticateUser, // A user must be logged in to fetch their cart
    CartController.fetchCart
);

router.post(
    '/add',
    authenticateUser, // User must be authenticated
    validateAddToCart, // Validate the request body
    CartController.addToCart // Controller function to handle the request
);

router.delete(
    '/remove/:itemId', // itemId will be extracted from URL parameters
    authenticateUser,   // User must be authenticated
    validateRemoveCartItem, // Validate the itemId from params
    CartController.removeCartItem // Controller function to handle the request
);

router.patch(
    '/update/:itemId', // itemId will be extracted from URL parameters
    authenticateUser,   // User must be authenticated
    validateUpdateCartItemQuantity, // Validate the itemId from params and quantity from body
    CartController.updateCartItemQuantity // Controller function to handle the request
);

router.delete(
    '/clear',
    authenticateUser, // A user must be logged in to clear their cart
    CartController.clearCart // Controller function to handle the request
);
export default router;