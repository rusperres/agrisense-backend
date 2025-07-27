import { ReportTargetType, ReportType, ReportStatus, ReportPriority } from '../enums';

export interface ReportEntity {
    id: string; // UUID or similar string ID
    reporter_id: string; // Foreign Key to users.id
    reporter_name: string; // Denormalized for easier access, but derived from user data
    target_id: string; // ID of the farmer, crop, or message being reported
    target_type: ReportTargetType; // Enum from backend/enums.ts
    target_name: string; // Denormalized for easier access
    report_type: ReportType; // Enum from backend/enums.ts
    description: string;
    report_date: string; // TIMESTAMP WITH TIME ZONE (ISO 8601 string)
    status: ReportStatus; // Enum from backend/enums.ts
    priority: ReportPriority; // Enum from backend/enums.ts
    admin_notes: string | null; // For internal admin notes
    action_taken: string | null; // What action was taken (e.g., 'User Warned', 'User Suspended')
    created_at: string; // TIMESTAMP WITH TIME ZONE (for auditing)
    updated_at: string; // TIMESTAMP WITH TIME ZONE (for auditing)
}


