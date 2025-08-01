
export interface CartItemEntity {
    id: string;
    productId: string;// References the ProductEntity by its ID
    quantity: number;
}


export interface CartEntity {
    id: string;
    userId: string;
    items: CartItemEntity[];
    createdAt: string;
    updatedAt: string;
}