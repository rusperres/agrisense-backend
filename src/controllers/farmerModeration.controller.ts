import { Request, Response, NextFunction } from 'express';
import * as FarmerModerationService from '../services/farmerModeration.service';
import { ApproveFarmerDTO, GetFarmerProfilesFilterDTO, RejectFarmerDTO } from '../types/dtos/farmerModeration.dto';

export const getFarmerProfiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters: GetFarmerProfilesFilterDTO = req.query;
        const farmerProfiles = await FarmerModerationService.getFarmerProfiles(filters);
        res.status(200).json(farmerProfiles);
    } catch (error) {
        next(error);
    }
};

export const approveFarmer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const data: ApproveFarmerDTO = req.body;
        const updatedFarmer = await FarmerModerationService.approveFarmer(id, data);
        res.status(200).json(updatedFarmer);
    } catch (error) {
        next(error);
    }
};

export const rejectFarmer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const data: RejectFarmerDTO = req.body;
        if (!data.reason) {
            res.status(400).json({ message: 'Rejection reason is required.' });
            return;
        }

        const updatedFarmer = await FarmerModerationService.rejectFarmer(id, data);
        res.status(200).json(updatedFarmer);
    } catch (error) {
        next(error);
    }
};