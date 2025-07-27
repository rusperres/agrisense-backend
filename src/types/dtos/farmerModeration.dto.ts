import { VerificationStatus } from '../enums';

export interface GetFarmerProfilesFilterDTO {
    status?: VerificationStatus;
    name?: string;
    email?: string;
    businessName?: string;
}

// DTO for approving a farmer
export interface ApproveFarmerDTO {
}

// DTO for rejecting a farmer
export interface RejectFarmerDTO {
    reason?: string; // Reason for rejection
}
