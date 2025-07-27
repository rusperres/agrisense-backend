import { ReportTargetType, ReportType, ReportStatus, ReportPriority } from "../enums";

export interface CreateReportDTO {
    targetId: string;
    targetType: ReportTargetType;
    targetName: string; // From the frontend, denormalized
    reportType: ReportType;
    description: string;
}

export interface ReportResponseDTO {
    id: string;
    reporterName: string;
    reporterId: string;
    targetType: ReportTargetType;
    targetName: string;
    targetId: string;
    reportType: ReportType;
    description: string;
    reportDate: string;
    status: ReportStatus;
    priority: ReportPriority;
    adminNotes?: string | null;
    actionTaken?: string | null;
    createdAt: string;
    updatedAt: string;
}

// DTO for fetching multiple reports (Response from Backend - e.g., an array of ReportResponseDTO)
export type ListReportsResponseDTO = ReportResponseDTO[];

// DTO for updating a report (Request to Backend)
export interface UpdateReportRequestDTO {
    status?: ReportStatus; // Only status can be updated via these actions
    adminNotes?: string;
    actionTaken?: string;
}