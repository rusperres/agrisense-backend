import { OrderStatus, PaymentMethod } from '../enums';
import { Location } from '../location';


// DTO for a single item when placing an order (adjusted to match frontend's PlaceOrderDTO item)
export interface PlaceOrderItemDTO {
    productId: string;
    quantity: number;
    pricePerUnit: number;
    subtotal: number;
}

// DTO for placing a new order (from the buyer's perspective, for their entire cart)
export interface PlaceOrderRequestDTO {
    items: PlaceOrderItemDTO[];
    paymentMethod: PaymentMethod;
    deliveryLocation: Location | null
}

// DTO for updating the status of an existing order
export interface UpdateOrderStatusRequestDTO {
    status: OrderStatus;
}

// DTO for fetching orders (e.g., filters, pagination)
export interface GetOrdersQueryDTO {
    buyerId?: string;
    sellerId?: string;
    status?: OrderStatus;
    page?: number;
    limit?: number;
}

// --- Response DTOs ---

export interface OrderResponseDTO {
    id: string;
    productId: string;
    productName: string;
    productImage: string;
    buyerId: string;
    sellerId: string;
    sellerName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalPrice: number;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    orderDate: string;
    estimatedDelivery?: string;
    deliveryLocation: Location | null;
    trackingNumber?: string | null;
    canReorder: boolean;
    canReview: boolean;
}


export interface GetOrdersResponseDTO {
    orders: OrderResponseDTO[];
    totalCount?: number;
    page?: number;
    limit?: number;
}

