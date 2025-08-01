import { Request, Response, NextFunction } from 'express';
import * as OrderService from '../services/order.service';
import { PlaceOrderRequestDTO, UpdateOrderStatusRequestDTO, GetOrdersQueryDTO } from '../types/dtos/order.dto';
import { UserRole, OrderStatus } from '../types/enums';

export const fetchOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { buyer_id, seller_id, status } = req.query as GetOrdersQueryDTO;

        let actualBuyerId: string | undefined = buyer_id;
        let actualSellerId: string | undefined = seller_id;
        let actualStatus: OrderStatus | undefined = status;

        if (req.user) {
            if (req.user.role === UserRole.Buyer) {
                actualBuyerId = req.user.id;
                actualSellerId = undefined;
            }
            else if (req.user.role === UserRole.Seller) {
                actualSellerId = req.user.id;
                actualBuyerId = undefined;
            }
        }

        const orders = await OrderService.fetchOrders(actualBuyerId, actualSellerId, actualStatus);

        res.status(200).json(orders);
    } catch (error) {
        next(error);
    }
};

export const placeOrder = async (req: Request, res: Response, next: NextFunction) => {
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

        res.status(201).json(newOrders);
    } catch (error) {
        next(error);
    }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body as UpdateOrderStatusRequestDTO;

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
