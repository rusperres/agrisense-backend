import { Request as ExpressRequest } from 'express';
import { UserRole } from "./enums";

export interface AuthenticatedRequest extends ExpressRequest {
    user?: {
        id: string;
        role: UserRole;
        phone: string;
        email: string | null;
        name: string;
    };
}