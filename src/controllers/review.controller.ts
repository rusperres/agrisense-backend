import { Request, Response, NextFunction } from 'express';
import * as ReviewService from '../services/review.service';
import { CreateReviewRequestDTO, GetReviewsQueryDTO } from '../types/dtos/review.dto';

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const buyerId = req.user?.id;
        if (!buyerId) {
            res.status(401).json({ message: 'Authentication required to submit a review.' });
            return;
        }

        const reviewData: CreateReviewRequestDTO = req.body;

        if (reviewData.buyerId !== buyerId) {
            res.status(403).json({ message: 'Unauthorized: You can only submit reviews for yourself.' });
            return;
        }

        const newReview = await ReviewService.createReview(reviewData);

        if (!newReview) {
            res.status(500).json({ message: 'Failed to submit review. No review was created.' });
            return;
        }

        res.status(201).json(newReview);
    } catch (error) {
        next(error);
    }
};

export const getReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queryParams: GetReviewsQueryDTO = req.query;
        const reviews = await ReviewService.getReviews(queryParams);
        res.status(200).json({ reviews });
    } catch (error) {
        next(error);
    }
};
