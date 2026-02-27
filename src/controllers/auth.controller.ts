import { Request, Response, NextFunction } from 'express';
import * as AuthService from '../services/auth.service';
import { CreateUserDTO, LoginRequestDTO, UpdateProfileRequestDTO } from '../types/dtos/user/user.request.dto';
import { LocationUpdateRequestDTO } from '../types/dtos/location.dto';
import { EWalletUpdateRequestDTO } from '../types/ewallet';
import { SellerVerificationRequestDTO } from '../types/dtos/verification.dto';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.registerUser(req.body);
    res.status(201).json({ result });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request<any, any, LoginRequestDTO>, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.loginUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userProfile = await AuthService.fetchUserProfileById(userId); 
    res.status(200).json({ result: userProfile }); 
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const updates: UpdateProfileRequestDTO = req.body;

    const result = await AuthService.updateUserProfile(userId, updates);
    res.status(200).json(result); 
  } catch (error) {
    next(error);
  }
};

export const updateUserLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const locationUpdates: LocationUpdateRequestDTO = req.body;

    const updatedUser = await AuthService.updateUserLocationInDB(userId, locationUpdates);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error); 
  }
};

export const updateUserEWalletDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const eWalletUpdates: EWalletUpdateRequestDTO = req.body;

    const updatedUser = await AuthService.updateUserEWalletDetailsInDB(userId, eWalletUpdates);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const submitSellerVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const verificationUpdates: SellerVerificationRequestDTO = req.body;

    const updatedUser = await AuthService.submitSellerVerification(userId, verificationUpdates);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};
