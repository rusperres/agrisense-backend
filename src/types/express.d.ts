import { Request as ExpressRequest } from 'express';
import { File } from 'multer';

// This is how you augment the Express module
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                role: UserRole; // Make sure to import UserRole from your enums file
                phone: string;
                email: string | null;
                name: string;
            };
            // Add other properties that Multer adds to the request
            file?: File;
            files?: File[];
        }
    }
}