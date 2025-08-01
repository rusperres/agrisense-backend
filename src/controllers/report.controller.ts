import { Request, Response, NextFunction } from 'express';
import {
    CreateReportDTO,
    UpdateReportRequestDTO,
    ReportResponseDTO,
    ListReportsResponseDTO,
} from '../types/dtos/report.dto';
import { ReportStatus, ReportPriority } from '../types/enums';

import * as ReportService from '../services/report.service';

/**
 * Helper function to map a ReportEntity to a ReportResponseDTO.
 * This ensures consistency in the data returned to the frontend.
 */
const mapReportEntityToResponseDTO = (entity: ReportService.ReportEntityFromService): ReportResponseDTO => {
    return {
        id: entity.id,
        reporterName: entity.reporter_name,
        reporterId: entity.reporter_id,
        targetType: entity.target_type,
        targetName: entity.target_name,
        targetId: entity.target_id,
        reportType: entity.report_type,
        description: entity.description,
        reportDate: entity.report_date,
        status: entity.status,
        priority: entity.priority,
        adminNotes: entity.admin_notes,
        actionTaken: entity.action_taken,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
    };
};

/**
 * Handles creating a new report.
 * Accessible by authenticated users (buyers/sellers).
 */
export const createReport = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id: reporterId, name: reporterName } = req.user!;
        const createReportData: CreateReportDTO = req.body as CreateReportDTO;

        const newReportEntity = await ReportService.createReport({
            ...createReportData,
            reporterId,
            reporterName,
        });

        const responseDTO: ReportResponseDTO = mapReportEntityToResponseDTO(newReportEntity);

        res.status(201).json(responseDTO);
    } catch (error) {
        next(error);
    }
};

/**
 * Handles fetching reports.
 * Accessible only by Admins.
 * Supports filtering by status via query parameter.
 */
export const getReports = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const statusFilter = (req.query as { status?: ReportStatus }).status;

        const reportEntities = await ReportService.getReports(statusFilter);

        const responseDTO: ListReportsResponseDTO = reportEntities.map(mapReportEntityToResponseDTO);

        res.status(200).json(responseDTO);
    } catch (error) {
        next(error);
    }
};

/**
 * Handles updating the status and notes of a specific report.
 * Accessible only by Admins.
 */
export const updateReportStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { reportId } = req.params as { reportId: string };
        const updates: UpdateReportRequestDTO = req.body as UpdateReportRequestDTO;

        const updatedReportEntity = await ReportService.updateReport(reportId, updates);

        const responseDTO: ReportResponseDTO = mapReportEntityToResponseDTO(updatedReportEntity);

        res.status(200).json(responseDTO);
    } catch (error) {
        next(error);
    }
};