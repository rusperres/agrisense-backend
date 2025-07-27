import { VerificationStatus } from '../enums';

export interface VerificationApplicationEntity {
  id: number;
  seller_id: number;
  government_id: string;
  business_license?: string | null;
  farm_certificate?: string | null;
  additional_docs?: string[] | null;
  status: VerificationStatus;
  reviewed_by?: number | null;
  review_notes?: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
}
