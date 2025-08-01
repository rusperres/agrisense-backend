import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types/enums';

interface JwtPayload {
    id: string;
    role: UserRole;
    phone: string;
    email: string | null;
    name: string;

}


export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Authentication token required.' });
            return;
        }

        const token = authHeader.split(' ')[1];

        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

        req.user = {
            id: payload.id,
            role: payload.role,
            phone: payload.phone,
            email: payload.email,
            name: payload.name
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(403).json({ message: 'Invalid or expired token.' });
            return;
        }
        next(error);
    }
};

export const authorizeRoles = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required for this action.' });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ message: `Access denied. Only ${allowedRoles.join(' or ')} can perform this action.` });
            return;
        }

        next();
    };
};

export const protect = (allowedRoles: UserRole[]) => [
    authenticateUser,
    authorizeRoles(allowedRoles)
];