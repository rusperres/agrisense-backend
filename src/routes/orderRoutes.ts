import { Router } from 'express';
import * as OrderController from '../controllers/order.controller';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../types/enums';
import { validatePlaceOrder, validateUpdateOrderStatus } from '../middlewares/validate.middleware';

const router = Router();

// GET /api/orders: Fetch orders (can be filtered by buyerId or sellerId)
// Authenticated users (buyers/sellers/admins) can fetch orders.
router.get(
    '/',
    authenticateUser,
    OrderController.fetchOrders
);

router.post(
    '/',
    authenticateUser,
    authorizeRoles([UserRole.Buyer]), // Only buyers can place orders
    validatePlaceOrder, // Validate the request body for placing an order
    OrderController.placeOrder // New controller function
);


router.patch(
    '/:id/status', // The order ID will be in req.params.id
    authenticateUser,
    authorizeRoles([UserRole.Seller, UserRole.Admin]), // Only sellers and admins can update status
    validateUpdateOrderStatus, // Validate the request body for status update
    OrderController.updateOrderStatus
);


export default router;