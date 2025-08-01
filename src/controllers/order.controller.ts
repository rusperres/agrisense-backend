import { Request, Response, NextFunction } from 'express';
import * as OrderService from '../services/order.service';
import { AuthenticatedRequest } from '../types/express';
import { PlaceOrderRequestDTO, UpdateOrderStatusRequestDTO, GetOrdersQueryDTO } from '../types/dtos/order.dto';
import { UserRole, OrderStatus } from '../types/enums';

export const fetchOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Extract query parameters for filtering
        const { buyer_id, seller_id, status } = req.query as GetOrdersQueryDTO;

        // Apply server-side filtering based on authenticated user's role
        let actualBuyerId: string | undefined = buyer_id;
        let actualSellerId: string | undefined = seller_id;
        let actualStatus: OrderStatus | undefined = status;

        if (req.user) {
            // A buyer can only fetch their own orders
            if (req.user.role === UserRole.Buyer) {
                actualBuyerId = req.user.id;
                actualSellerId = undefined; // Buyer cannot arbitrarily filter by other seller's IDs
            }
            // A seller can only fetch orders where they are the seller
            else if (req.user.role === UserRole.Seller) {
                actualSellerId = req.user.id;
                actualBuyerId = undefined; // Seller cannot arbitrarily filter by other buyer's IDs
            }
            // Admins can fetch any orders, so they can use provided buyerId/sellerId or fetch all
        }

        // Call the service function with the filtered parameters
        const orders = await OrderService.fetchOrders(actualBuyerId, actualSellerId, actualStatus);

        res.status(200).json(orders);
    } catch (error) {
        next(error);
    }
};

export const placeOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log('Controller');
    try {
        const buyerId = req.user?.id;
        if (!buyerId) {
            res.status(401).json({ message: 'User not authenticated.' });
            return;
        }

        const placeOrderRequestDTO = req.body as PlaceOrderRequestDTO;
        const newOrders = await OrderService.placeOrder(buyerId, placeOrderRequestDTO);

        if (!newOrders) {
            res.status(400).json({ message: 'Failed to place order. Check if all products exist and quantities are sufficient.' });
            return;
        }

        res.status(201).json(newOrders); // Return 201 Created and the array of new orders
    } catch (error) {
        next(error); // Pass to global error handler
    }
};

export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body as UpdateOrderStatusRequestDTO;

        // Get user info from the authenticated request
        const user = req.user;
        if (!user) {
            res.status(401).json({ message: 'User not authenticated.' });
            return;
        }

        if (user.role === UserRole.Seller) {
            const allowedSellerStatuses = [
                OrderStatus.Processing,
                OrderStatus.Shipped,
                OrderStatus.Delivered,
                OrderStatus.Cancelled
            ];
            if (!allowedSellerStatuses.includes(status)) {
                res.status(403).json({ message: `Sellers cannot set order status to '${status}'.` });
                return;
            }
        } else if (user.role === UserRole.Buyer) {
            if (status !== OrderStatus.Cancelled) {
                res.status(403).json({ message: `Buyers cannot set order status to '${status}'.` });
                return;
            }
        }

        // Call the service function with all required arguments
        const updatedOrder = await OrderService.updateOrderStatus(orderId, status, user.role, user.id);

        if (!updatedOrder) {
            res.status(404).json({ message: 'Order not found.' });
            return;
        }

        res.status(200).json(updatedOrder);
    } catch (error) {
        next(error);
    }
};
