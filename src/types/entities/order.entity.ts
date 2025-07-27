import { OrderStatus, PaymentMethod } from '../enums';
import { DBLocation } from '../location';

export interface OrderItemEntity {
    id: string;
    productId: string;
    productName: string;
    productImage: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    subtotal: number;
}

export interface OrderEntity {
    id: string;
    buyerId: string;
    sellerId: string;
    sellerName: string;
    orderItems: OrderItemEntity[];
    totalPrice: number;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    deliveryLocation: DBLocation | null;
    trackingNumber: string | null;
    orderDate: Date;
    estimatedDeliveryDate: Date | null;
    canReorder: boolean;
    canReview: boolean;
    createdAt: Date;
    updatedAt: Date;
}