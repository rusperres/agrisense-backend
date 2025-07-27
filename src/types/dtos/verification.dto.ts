import { VerificationStatus } from '../enums';

export interface SubmitVerificationDTO {
  seller_id: number;
  government_id: string;
  business_license?: string | null;
  farm_certificate?: string | null;
  additional_docs?: string[] | null;
}

export interface ReviewVerificationDTO {
  status: VerificationStatus;              // 'approved' or 'rejected'
  reviewed_by: number;
  review_notes?: string | null;
}
