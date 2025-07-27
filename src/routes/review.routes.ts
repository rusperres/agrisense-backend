import { Router } from 'express';
import * as ReviewController from '../controllers/review.controller';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../types/enums'; // Assuming UserRole is defined here or similar path
import { validateCreateReview, validateGetReviews } from '../middlewares/validate.middleware'; // We'll add this soon

const router = Router();

// Route to submit a new review
router.post(
    '/',
    authenticateUser,
    authorizeRoles([UserRole.Buyer]), // Only buyers can submit reviews
    validateCreateReview, // Validate the request body for creating a review
    ReviewController.createReview
);

// Route to fetch reviews (e.g., by product, seller, order)
router.get(
    '/',
    authenticateUser,
    authorizeRoles([UserRole.Buyer, UserRole.Seller]), // Both buyers and sellers might fetch reviews
    validateGetReviews, // Validate query parameters for fetching reviews
    ReviewController.getReviews
);

export default router;