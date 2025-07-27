import { Request, Response, NextFunction } from 'express';
import * as CropListingService from '../services/cropListing.service';
import { GetCropListingsQueryDTO } from '../types/dtos/cropListing.dto'; // Backend DTOs
import { AuthenticatedRequest } from '../types/express'; // To access req.user if needed

export const fetchCropListings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Extract query parameters for filtering
        const filters: GetCropListingsQueryDTO = {
            status: req.query.status as any, // Cast to CropListingStatus enum
            farmer_id: req.query.farmer_id as string,
            // Add other filters as they become available in the DTO
        };

        // Pass filters to the service layer
        const cropListings = await CropListingService.fetchCropListings(filters);
        res.status(200).json(cropListings);
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

export const approveCrop = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { cropId } = req.params; // Get cropId from URL parameters
        const updatedCrop = await CropListingService.approveCrop(cropId);
        res.status(200).json(updatedCrop);
    } catch (error) {
        next(error);
    }
};


export const rejectCrop = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { cropId } = req.params; // Get cropId from URL parameters
        const { reason } = req.body; // Get reason from request body

        // Optional: Get moderator ID for logging/auditing
        // const moderatorId = req.user?.id;

        const updatedCrop = await CropListingService.rejectCrop(cropId, reason); // Call service
        res.status(200).json(updatedCrop); // Send the updated crop back
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

export const flagCrop = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { cropId } = req.params; // Get cropId from URL parameters
        const { reason } = req.body; // Get reason from request body (required)

        // Optional: Get moderator ID for logging/auditing
        // const moderatorId = req.user?.id;

        const updatedCrop = await CropListingService.flagCrop(cropId, reason); // Call service
        res.status(200).json(updatedCrop); // Send the updated crop back
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};