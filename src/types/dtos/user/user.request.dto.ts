import { UserRole } from '../../enums';




// DTO for user registration or creation (e.g., signup)
export interface CreateUserDTO {
    name: string;
    phone: string;
    email?: string | null; // Optional if not provided
    password: string;
    role: UserRole;
}

export interface LoginRequestDTO {
    phone: string;
    password: string;
}

export interface UpdateProfileRequestDTO {
    name?: string;
    email?: string;
    phone?: string;
    // Location update only includes address from this specific frontend flow
    location?: {
        address: string;
    };
}

export interface SuspendUserRequestDTO {
    reason: string;
}
