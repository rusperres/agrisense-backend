import { Router } from 'express';
import * as ProductController from '../controllers/product.controller';
import { validateCreateProduct, validateProductId, validateUpdateProduct } from '../middlewares/validate.middleware'; // We'll add these
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware'; // Reuse your auth middleware
import { UserRole } from '../types/enums'; // Import UserRole enum

const router = Router();

router.post('/', authenticateUser,
    authorizeRoles([UserRole.Seller]), // Only sellers can add products
    validateCreateProduct, // Validation for CreateProductDTO
    ProductController.createProduct
);

router.patch(
    '/:id', // Product ID in the URL parameter
    authenticateUser,
    authorizeRoles([UserRole.Seller, UserRole.Admin]), // Allow sellers to update their own, and admins to update any
    validateUpdateProduct, // Validation for UpdateProductDTO
    ProductController.updateProduct
);

router.delete(
    '/:id', // Product ID in the URL parameter
    authenticateUser,
    authorizeRoles([UserRole.Seller, UserRole.Admin]), // Allow sellers to delete their own, and admins to delete any
    ProductController.deleteProduct
);

router.get(
    '/',
    authenticateUser,
    ProductController.fetchProducts
);

router.get(
    '/:id',
    validateProductId, // Validate the product ID from URL params
    ProductController.fetchProductById
);



router.get(
    '/seller', authenticateUser,
    authorizeRoles([UserRole.Seller]),
    ProductController.fetchProductsBySellerId);

export default router;