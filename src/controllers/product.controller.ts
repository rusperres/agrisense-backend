import { Request, Response, NextFunction } from 'express';
import * as ProductService from '../services/product.service';
import { CreateProductDTO, UpdateProductDTO } from '../types/dtos/product.dto'; // Ensure correct path to backend product DTOs
import { AuthenticatedRequest } from '../types/express'; // To access req.user

/**
 * Handles the creation of a new product.
 * Requires authentication and seller role.
 */
export const createProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

export const updateProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const productId = req.params.id; // Get product ID from URL parameters
        const userId = req.user!.id; // Get authenticated user's ID
        const userRole = req.user!.role; // Get authenticated user's role

        const updates: UpdateProductDTO = req.body; // Get updates from request body

        const updatedProduct = await ProductService.updateProduct(productId, userId, userRole, updates);
        // Respond with 200 OK and the updated product data (ProductResponseDTO)
        res.status(200).json(updatedProduct);
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

export const deleteProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const productId = req.params.id; // Get product ID from URL parameters
        const userId = req.user!.id;     // Get authenticated user's ID
        const userRole = req.user!.role; // Get authenticated user's role

        // Call the service layer to handle the deletion logic
        await ProductService.deleteProduct(productId, userId, userRole);

        // Respond with 204 No Content for successful deletion
        res.status(204).send();
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

export const fetchProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // No specific user ID or role needed for a general fetch,
        // unless you plan to implement user-specific product listings later.
        const products = await ProductService.fetchProducts();
        res.status(200).json(products);
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

export const fetchProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params; // Get product ID from URL parameters
        const product = await ProductService.fetchProductById(id);
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        next(error); // Pass error to global error handler
    }
};

/**
 * Handles fetching products listed by the authenticated seller.
 * Requires authentication and seller role (implicitly handled by middleware on the route).
 */
export const fetchProductsBySellerId = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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