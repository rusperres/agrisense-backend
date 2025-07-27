import { Request, Response, NextFunction } from 'express';
import * as OrderService from '../services/order.service';
import { AuthenticatedRequest } from '../types/express';
import { PlaceOrderRequestDTO, UpdateOrderStatusRequestDTO, GetOrdersQueryDTO } from '../types/dtos/order.dto';
import { UserRole, OrderStatus } from '../types/enums';

export const fetchOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Extract query parameters for filtering
        const { buyerId, sellerId } = req.query as GetOrdersQueryDTO;

        // Apply server-side filtering based on authenticated user's role
        let actualBuyerId: string | undefined = buyerId;
        let actualSellerId: string | undefined = sellerId;

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

        const orders = await OrderService.fetchOrders(actualBuyerId, actualSellerId);
        res.status(200).json({ orders }); // Wrap in 'orders' array as per BackendOrderResponse
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

export const placeOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const buyerId = req.user?.id; // The authenticated user's ID will be the buyerId

        if (!buyerId) {
            // This case should ideally be caught by `authenticateUser` middleware
            res.status(401).json({ message: 'Authentication required to place an order.' });
            return;
        }

        const orderData: PlaceOrderRequestDTO = req.body; // The validated body from validatePlaceOrder

        // Additional business logic check: ensure buyer is not placing orders for someone else
        // (This is implicitly handled if you only extract buyerId from req.user)

        const newOrders = await OrderService.placeOrder(buyerId, orderData);

        if (!newOrders || newOrders.length === 0) {
            res.status(500).json({ message: 'Failed to place order. No orders were created.' });
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


        if (req.user && req.user.role === UserRole.Seller) {
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
        } else if (req.user && req.user.role === UserRole.Buyer) {
            if (status !== OrderStatus.Cancelled) {
                res.status(403).json({ message: `Buyers cannot set order status to '${status}'.` });
                return;
            }
        }


        const updatedOrder = await OrderService.updateOrderStatus(orderId, status);

        if (!updatedOrder) {
            res.status(404).json({ message: 'Order not found.' });
            return;
        }

        res.status(200).json(updatedOrder);
    } catch (error) {
        next(error);
    }
};