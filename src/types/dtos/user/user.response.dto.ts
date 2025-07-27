import { UserRole, VerificationStatus } from '../../enums';
import { LocationResponse } from '../../location';
import { EWalletDetails } from '../../ewallet';

export interface BaseUserResponseDTO {
    id: string;
    email: string | null;
    phone: string;
    name: string;
    role: UserRole;
    location: LocationResponse | null;
    avatar?: string | null;
    createdAt: string;
    updatedAt: string;
    eWalletDetails: EWalletDetails | null; 
}

export interface SellerResponseDTO extends BaseUserResponseDTO {
    businessName: string | null;
    isVerified: boolean; 
    verificationStatus: VerificationStatus;
    credentials: {
        documents: string[];
        businessLicense?: string | null;
        farmCertificate?: string | null;
        governmentId: string;
    } | null;
    rating: number | null;
    reviewCount: number;
    totalSales: number;
    // eWalletDetails?: { <-- Jairus: removed as all types can have this
    //     provider: string; // e.g., 'GCash', 'PayMaya', 'PayPal'
    //     accountNumber: string;
    //     accountName: string;
    //     qrCodeImage?: string;
    // };
}

export interface BuyerResponseDTO extends BaseUserResponseDTO {
    purchaseHistory: string[];  
    favoriteProducts: string[]; 
}

export interface AdminResponseDTO extends BaseUserResponseDTO {
    // Admin-specific fields (e.g., lastLoginIp, adminPermissions, etc.)

}

export type UserResponseDTO = BaseUserResponseDTO | SellerResponseDTO | BuyerResponseDTO | AdminResponseDTO;

export interface LoginResponseDTO {
    user: UserResponseDTO; 
    token: string;
}