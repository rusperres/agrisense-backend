import { CropListingStatus } from '../enums'; // Adjust path as per your backend structure
import { Location } from '../location'; // Adjust path

// DTO for creating a new crop listing
export interface CreateCropListingDTO {
    crop_name: string;
    variety?: string | null; // Optional based on whether all crops have a specific variety
    farmer_id: string; // ID of the farmer submitting the listing
    price: number;
    unit: string;
    quantity: number;
    images?: string[] | null; // Optional
    description?: string | null; // Optional
    location?: Location | null; // Optional
    // submission_date, status, is_suspicious, flag_reason, created_at, updated_at
    // are typically set by the backend, so they are omitted here.
}

// DTO for updating an existing crop listing (e.g., by the farmer or admin)
// All fields are optional as it's a partial update
export interface UpdateCropListingDTO {
    crop_name?: string;
    variety?: string | null;
    price?: number;
    unit?: string;
    quantity?: number;
    images?: string[] | null;
    description?: string | null;
    location?: Location | null;
    // For moderation updates, you might have specific DTOs or include these directly
    status?: CropListingStatus;
    is_suspicious?: boolean;
    flag_reason?: string | null;
}

// DTO for approving a crop listing
export interface ApproveCropListingDTO {
    // No specific fields needed for a simple approval, just the ID in the URL/body
}

// DTO for rejecting a crop listing
export interface RejectCropListingDTO {
    reason?: string; // Reason for rejection is often optional, but good to include
}

// DTO for flagging a crop listing
export interface FlagCropListingDTO {
    reason: string; // Reason for flagging is typically required
}

// DTO for the full Crop Listing object returned by the API
// This should match the CropListing interface from the frontend (with snake_case)
export interface CropListingResponseDTO {
    id: string;
    crop_name: string;
    variety: string | null;
    farmer_name: string; // Assuming backend will populate this based on farmer_id
    farmer_id: string;
    price: number;
    unit: string;
    quantity: number;
    submission_date: string; // ISO 8601 string
    status: CropListingStatus;
    images: string[] | null;
    description: string | null;
    location: Location | null;
    is_suspicious: boolean;
    flag_reason: string | null;
    created_at: string; // ISO 8601 string
    updated_at: string; // ISO 8601 string
}

// DTO for querying/filtering crop listings (e.g., for a GET request)
export interface GetCropListingsQueryDTO {
    status?: CropListingStatus;
    farmer_id?: string;
    // Add other filterable fields as query parameters
    min_price?: number;
    max_price?: number;
    crop_name?: string;
    location_address?: string; // If you want to filter by location address string
    // Pagination
    page?: number;
    limit?: number;
}