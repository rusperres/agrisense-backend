// src/controllers/admin.controller.ts
import { Response, NextFunction } from 'express'; // Removed 'Request' as it's part of AuthenticatedRequest
import { AuthenticatedRequest } from '../types/express'; // Your custom AuthenticatedRequest
import * as AdminService from '../services/admin.service'; // Assuming you will create this service
import {
    ApproveApplicationRequestDTO,
    RejectApplicationRequestDTO,
    SuspendUserRequestDTO,
    GetApplicationsResponseDTO,
    GetUsersResponseDTO,
    SingleApplicationResponseDTO,
    SingleUserResponseDTO,
} from '../types/dtos/admin.dto'; // Your admin DTOs

/**
 * Handles fetching all verification applications.
 * Requires admin authentication.
 */
export const getApplications = async (req: AuthenticatedRequest, res: Response<GetApplicationsResponseDTO>, next: NextFunction) => {
    try {
        const applications = await AdminService.getApplications();
        res.status(200).json(applications);
    } catch (error) {
        next(error);
    }
};

/**
 * Handles approving a verification application.
 * Requires admin authentication.
 */
export const approveApplication = async (
    req: AuthenticatedRequest, // No explicit type parameters here
    res: Response<SingleApplicationResponseDTO>,
    next: NextFunction
) => {
    try {
        // We cast req.params and req.body as needed, relying on runtime validation (middlewares)
        // and the type definitions for the DTOs when accessing properties.
        const { applicationId } = req.params as { applicationId: string };
        const { notes } = req.body as ApproveApplicationRequestDTO;
        const adminId = req.user!.id;

        const updatedApplication = await AdminService.approveApplication(applicationId, notes, adminId);
        res.status(200).json(updatedApplication);
    } catch (error) {
        next(error);
    }
};

/**
 * Handles rejecting a verification application.
 * Requires admin authentication.
 */
export const rejectApplication = async (
    req: AuthenticatedRequest, // No explicit type parameters here
    res: Response<SingleApplicationResponseDTO>,
    next: NextFunction
) => {
    try {
        const { applicationId } = req.params as { applicationId: string };
        const { notes } = req.body as RejectApplicationRequestDTO;
        const adminId = req.user!.id;

        const updatedApplication = await AdminService.rejectApplication(applicationId, notes, adminId);
        res.status(200).json(updatedApplication);
    } catch (error) {
        next(error);
    }
};

/**
 * Handles fetching all users.
 * Requires admin authentication.
 */
export const getUsers = async (req: AuthenticatedRequest, res: Response<GetUsersResponseDTO>, next: NextFunction) => {
    try {
        const users = await AdminService.getUsers();
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

/**
 * Handles suspending a user.
 * Requires admin authentication.
 */
export const suspendUser = async (
    req: AuthenticatedRequest, // No explicit type parameters here
    res: Response<SingleUserResponseDTO>,
    next: NextFunction
) => {
    try {
        const { userId } = req.params as { userId: string };
        const { reason } = req.body as SuspendUserRequestDTO;
        const adminId = req.user!.id;

        const updatedUser = await AdminService.suspendUser(userId, reason, adminId);
        res.status(200).json(updatedUser);
    } catch (error) {
        next(error);
    }
};