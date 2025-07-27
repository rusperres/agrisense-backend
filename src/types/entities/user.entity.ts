import { DBLocation } from '../location';  
import { UserRole, VerificationStatus } from '../enums'; 
import { EWalletDetails } from '../ewallet';

export interface UserEntity {
    id: string;
    name: string;
    email: string;
    password: string; // Hashed password, never returned to frontend
    phone: string; 
    avatar: string | null;
    role: UserRole;
    location: DBLocation | null;
    created_at: string; // TIMESTAMP WITH TIME ZONE
    updated_at: string; // TIMESTAMP WITH TIME ZONE
    eWalletDetails: EWalletDetails | null;
}

export interface SellerEntity {
    user_id: number; // Foreign Key to users.id
    business_name: string | null;
    is_verified: boolean; 
    verification_status: VerificationStatus;
    credentials: {
        documents: string[];
        businessLicense?: string;
        farmCertificate?: string;
        governmentId: string;
    } | null;
    rating: number; // NUMERIC, NOT NULL, with default 0.0
    review_count: number; // INT, NOT NULL, with default 0
    total_sales: number; // INT, NOT NULL, with default 0
}

export interface BuyerEntity {
    user_id: number; // Foreign Key to users.id
    purchase_history: string[]; 
    favorite_products: string[]; 
}

export interface AdminEntity {
    user_id: number;
}