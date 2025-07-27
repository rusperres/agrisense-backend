import { Request, Response, NextFunction } from 'express';
import * as FarmerModerationService from '../services/farmerModeration.service';
import { ApproveFarmerDTO, GetFarmerProfilesFilterDTO, RejectFarmerDTO } from '../types/dtos/farmerModeration.dto';
import { AuthenticatedRequest } from '../types/express';

export const getFarmerProfiles = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const filters: GetFarmerProfilesFilterDTO = req.query; // Query parameters become filters
        const farmerProfiles = await FarmerModerationService.getFarmerProfiles(filters);
        res.status(200).json(farmerProfiles);
    } catch (error) {
        next(error);
    }
};

// Controller for approving a farmer
export const approveFarmer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params; // Farmer ID from URL parameter
        const data: ApproveFarmerDTO = req.body; // Any additional data for approval (currently empty DTO)

        const updatedFarmer = await FarmerModerationService.approveFarmer(id, data);
        res.status(200).json(updatedFarmer); // Return the updated farmer profile
    } catch (error) {
        next(error);
    }
};

// Controller for rejecting a farmer
export const rejectFarmer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params; // Farmer ID from URL parameter
        const data: RejectFarmerDTO = req.body; // Reason for rejection

        if (!data.reason) {
            res.status(400).json({ message: 'Rejection reason is required.' });
            return;
        }

        const updatedFarmer = await FarmerModerationService.rejectFarmer(id, data);
        res.status(200).json(updatedFarmer); // Return the updated farmer profile
    } catch (error) {
        next(error);
    }
};