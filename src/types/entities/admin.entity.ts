import { VerificationStatus } from '../enums';
import { VerificationDocuments } from '../dtos/admin.dto';

export interface VerificationApplicationEntity {
    id: number;
    seller_id: number;
    documents: VerificationDocuments;
    status: VerificationStatus;
    submitted_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    review_notes: string | null;
}