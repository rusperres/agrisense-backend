import { Request, Response, NextFunction } from 'express';
import * as AdminService from '../services/admin.service';
import {
    ApproveApplicationRequestDTO,
    RejectApplicationRequestDTO,
    SuspendUserRequestDTO,
    GetApplicationsResponseDTO,
    GetUsersResponseDTO,
    SingleApplicationResponseDTO,
    SingleUserResponseDTO,
} from '../types/dtos/admin.dto';

/**
 * Handles fetching all verification applications.
 * Requires admin authentication.
 */
export const getApplications = async (req: Request, res: Response<GetApplicationsResponseDTO>, next: NextFunction) => {
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
    req: Request,
    res: Response<SingleApplicationResponseDTO>,
    next: NextFunction
) => {
    try {
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
    req: Request,
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
export const getUsers = async (req: Request, res: Response<GetUsersResponseDTO>, next: NextFunction) => {
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
    req: Request,
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