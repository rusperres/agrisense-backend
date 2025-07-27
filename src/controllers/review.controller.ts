import { Request, Response, NextFunction } from 'express';
import * as ReviewService from '../services/review.service'; // We'll create this next
import { AuthenticatedRequest } from '../types/express';
import { CreateReviewRequestDTO, GetReviewsQueryDTO } from '../types/dtos/review.dto';

/**
 * @function createReview
 * @description Handles the submission of a new review.
 * Ensures the authenticated user is the buyer ID provided in the review data.
 */
export const createReview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const buyerId = req.user?.id; // Authenticated user's ID
        if (!buyerId) {
            res.status(401).json({ message: 'Authentication required to submit a review.' });
            return;
        }

        const reviewData: CreateReviewRequestDTO = req.body;

        // IMPORTANT: Ensure the buyerId from the token matches the buyerId in the request body
        // This prevents a user from submitting a review on behalf of another user.
        if (reviewData.buyerId !== buyerId) {
            res.status(403).json({ message: 'Unauthorized: You can only submit reviews for yourself.' });
            return;
        }

        const newReview = await ReviewService.createReview(reviewData);

        if (!newReview) {
            res.status(500).json({ message: 'Failed to submit review. No review was created.' });
            return;
        }

        res.status(201).json(newReview); // Return 201 Created and the new review
    } catch (error) {
        next(error); // Pass to global error handler
    }
};

/**
 * @function getReviews
 * @description Handles fetching reviews based on query parameters (productId, sellerId, orderId).
 */
export const getReviews = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const queryParams: GetReviewsQueryDTO = req.query; // Query parameters are directly mapped
        const reviews = await ReviewService.getReviews(queryParams);
        res.status(200).json({ reviews }); // Return reviews in the expected BackendReviewsResponse format
    } catch (error) {
        next(error);
    }
};