import { Request, Response, NextFunction } from 'express';
import * as ProductService from '../services/product.service';
import { CreateProductDTO, UpdateProductDTO } from '../types/dtos/product.dto';

/**
 * Handles the creation of a new product.
 * Requires authentication and seller role.
 */
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sellerId = req.user!.id;
        const productData: CreateProductDTO = {
            ...req.body,
            seller_id: sellerId,
        };

        const newProduct = await ProductService.createProduct(productData);
        res.status(201).json(newProduct);
    } catch (error) {
        next(error);
    }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const productId = req.params.id;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        const updates: UpdateProductDTO = req.body;

        const updatedProduct = await ProductService.updateProduct(productId, userId, userRole, updates);
        res.status(200).json(updatedProduct);
    } catch (error) {
        next(error);
    }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const productId = req.params.id;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        await ProductService.deleteProduct(productId, userId, userRole);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const fetchProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const products = await ProductService.fetchProducts();
        res.status(200).json(products);
    } catch (error) {
        next(error);
    }
};

export const fetchProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const product = await ProductService.fetchProductById(id);
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        next(error);
    }
};

/**
 * Handles fetching products listed by the authenticated seller.
 * Requires authentication and seller role (implicitly handled by middleware on the route).
 */
export const fetchProductsBySellerId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sellerId = req.user!.id;
        if (!sellerId) {
            res.status(401).json({ message: 'Unauthorized: Seller ID not found' });
            return;
        }
        const products = await ProductService.fetchProductsBySellerId(sellerId);
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching seller products:', error);
        next(error);
    }
};