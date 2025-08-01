import { Request, Response, NextFunction } from 'express';
import * as AuthService from '../services/auth.service';
import { CreateUserDTO, LoginRequestDTO, UpdateProfileRequestDTO } from '../types/dtos/user/user.request.dto';
import { LocationUpdateRequestDTO } from '../types/dtos/location.dto';
import { AuthenticatedRequest } from '../types/express';
import { EWalletUpdateRequestDTO } from '../types/ewallet';
import { SellerVerificationRequestDTO } from '../types/dtos/verification.dto';

export const register = async (req: Request<any, any, CreateUserDTO>, res: Response, next: NextFunction) => {
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

export const getUserProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id; // Get user ID from the authenticated request
    const userProfile = await AuthService.fetchUserProfileById(userId); // Call the service function
    res.status(200).json({ result: userProfile }); // Send the user profile as JSON
  } catch (error) {
    next(error); // Pass errors to the error handling middleware
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const updates: UpdateProfileRequestDTO = req.body; // <--- ADD THIS LINE IF NEEDED

    const result = await AuthService.updateUserProfile(userId, updates);
    res.status(200).json(result); // 200 OK with the updated user data
  } catch (error) {
    next(error); // Pass error to global error handler
  }
};

export const updateUserLocation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id; // User ID from authenticated session
    const locationUpdates: LocationUpdateRequestDTO = req.body; // Validated location data from frontend

    const updatedUser = await AuthService.updateUserLocationInDB(userId, locationUpdates);
    res.status(200).json(updatedUser); // Send back the updated user profile
  } catch (error) {
    next(error); // Pass error to global error handler
  }
};

export const updateUserEWalletDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id; // User ID from authenticated session
    const eWalletUpdates: EWalletUpdateRequestDTO = req.body; // Validated e-wallet data

    const updatedUser = await AuthService.updateUserEWalletDetailsInDB(userId, eWalletUpdates);
    res.status(200).json(updatedUser); // Send back the updated user profile
  } catch (error) {
    next(error); // Pass error to global error handler
  }
};

export const submitSellerVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id; // Get user ID from the authenticated request
    const verificationUpdates: SellerVerificationRequestDTO = req.body; // Validated data from the verification form

    const updatedUser = await AuthService.submitSellerVerification(userId, verificationUpdates);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};