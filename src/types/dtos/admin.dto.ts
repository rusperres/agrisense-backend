import { VerificationStatus, UserRole } from '../enums';
import { UserResponseDTO } from '../dtos/user/user.response.dto'; // Import from your shared user types

// Represents the documents provided for verification
export interface VerificationDocuments {
    governmentId: string;
    businessLicense?: string; // Optional for some sellers
    farmCertificate?: string; // Optional for some sellers
    additionalDocs?: string[]; // Array of URLs for other documents
}

// Represents a single verification application
export interface VerificationApplication {
    id: string;
    sellerId: string; // ID of the seller
    documents: VerificationDocuments;
    status: VerificationStatus; // 'pending' | 'approved' | 'rejected'
    submittedAt: Date; // Stored as Date objects in backend, often as ISO strings in DB
    reviewedAt?: Date; // Stored as Date objects in backend, often as ISO strings in DB
    reviewedBy?: string; // ID of the admin who reviewed it
    reviewNotes?: string;
}

// Represents a user from the admin's perspective,
// which is currently the same as the general User type.
export type AdminUserView = UserResponseDTO;

// --- Request DTOs (Data Transfer Objects) for API Endpoints ---

export interface ApproveApplicationRequestDTO {
    notes?: string;
}

export interface RejectApplicationRequestDTO {
    notes: string; // Notes are typically required for rejection
}

export interface SuspendUserRequestDTO {
    reason: string;
}

// --- Response DTOs for API Endpoints ---

export interface GetApplicationsResponseDTO {
    applications: VerificationApplication[];
    totalCount: number; // For pagination
}

export interface GetUsersResponseDTO {
    users: UserResponseDTO[]; // Use the shared User type
    totalCount: number; // For pagination
}

// Response DTO for a single verification application after approval/rejection
// (This type is the same as the VerificationApplication itself, but explicitly defined as a DTO)
export type SingleApplicationResponseDTO = VerificationApplication;

// Response DTO for a single user after suspension/update
// (This type is the same as the User itself, but explicitly defined as a DTO)
export type SingleUserResponseDTO = UserResponseDTO;