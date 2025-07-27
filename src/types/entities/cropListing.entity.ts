import { CropListingStatus } from '../enums'; // Adjust path
import { DBLocation } from '../location'; // Adjust path

// Interface representing the Crop Listing object as it is stored in the database
// This should ideally map directly to your database schema (e.g., table columns)
export interface CropListingEntity {
    id: string;
    crop_name: string;
    variety: string | null;
    farmer_name: string;
    farmer_id: string;
    price: number;
    unit: string;
    quantity: number;
    submission_date: Date; // Stored as a Date object in the DB, converted to string for DTOs
    status: CropListingStatus;
    images: string[] | null; // Assuming images are stored as an array of URLs/paths
    description: string | null;
    location: DBLocation | null; // Using DBLocation type for geo-spatial data
    is_suspicious: boolean;
    flag_reason: string | null;
    created_at: Date;
    updated_at: Date;
}

