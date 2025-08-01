import { Request, Response, NextFunction } from 'express';
import * as CropListingService from '../services/cropListing.service';
import { GetCropListingsQueryDTO } from '../types/dtos/cropListing.dto';

export const fetchCropListings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters: GetCropListingsQueryDTO = {
            status: req.query.status as any,
            farmer_id: req.query.farmer_id as string,
        };

        const cropListings = await CropListingService.fetchCropListings(filters);
        res.status(200).json(cropListings);
    } catch (error) {
        next(error);
    }
};

export const approveCrop = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { cropId } = req.params;
        const updatedCrop = await CropListingService.approveCrop(cropId);
        res.status(200).json(updatedCrop);
    } catch (error) {
        next(error);
    }
};


export const rejectCrop = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { cropId } = req.params;
        const { reason } = req.body;

        const updatedCrop = await CropListingService.rejectCrop(cropId, reason);
        res.status(200).json(updatedCrop);
    } catch (error) {
        next(error);
    }
};

export const flagCrop = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { cropId } = req.params;
        const { reason } = req.body;

        const updatedCrop = await CropListingService.flagCrop(cropId, reason);
        res.status(200).json(updatedCrop);
    } catch (error) {
        next(error);
    }
};