import { Router } from 'express';
import * as CartController from '../controllers/cart.controller';
import { authenticateUser } from '../middlewares/auth.middleware';
import { validateAddToCart, validateRemoveCartItem, validateUpdateCartItemQuantity } from '../middlewares/validate.middleware';

const router = Router();

router.get(
    '/',
    authenticateUser, 
    CartController.fetchCart
);

router.post(
    '/add',
    authenticateUser,
    validateAddToCart, 
    CartController.addToCart 
);

router.delete(
    '/remove/:itemId', 
    authenticateUser,  
    validateRemoveCartItem,
    CartController.removeCartItem 
);

router.patch(
    '/update/:itemId', 
    authenticateUser,  
    validateUpdateCartItemQuantity, 
    CartController.updateCartItemQuantity 
);

router.delete(
    '/clear',
    authenticateUser, 
    CartController.clearCart 
);
export default router;
