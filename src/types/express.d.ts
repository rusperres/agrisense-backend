import { Request as ExpressRequest } from 'express';
import { File } from 'multer';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                role: UserRole;
                phone: string;
                email: string | null;
                name: string;
            };
            file?: File;
            files?: File[];
        }
    }
}