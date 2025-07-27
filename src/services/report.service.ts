import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/db';
import {
    CreateReportDTO,
    UpdateReportRequestDTO,
} from '../types/dtos/report.dto';
import { ReportEntity } from '../types/entities/report.entity';
import { ReportStatus, ReportPriority, ReportType } from '../types/enums';

export type ReportEntityFromService = ReportEntity;

/**
 * Helper function to set a default priority for a new report.
 * You might have more sophisticated logic here based on reportType or other factors.
 */
const getDefaultReportPriority = (reportType: ReportType): ReportPriority => {
    // Example logic:
    switch (reportType) {
        case ReportType.Scam:
        case ReportType.Abuse:
            return ReportPriority.High;
        case ReportType.Inappropriate:
            return ReportPriority.Medium;
        default:
            return ReportPriority.Low;
    }
};

/**
 * Creates a new report in the database.
 * This function handles the database insertion for a new report.
 */
export const createReport = async (
    reportData: CreateReportDTO & { reporterId: string; reporterName: string }
): Promise<ReportEntityFromService> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const newReportId = uuidv4();
        const currentTimestamp = new Date().toISOString();
        const defaultStatus = ReportStatus.Pending;
        const defaultPriority = getDefaultReportPriority(reportData.reportType);

        const result = await client.query<ReportEntity>(
            `INSERT INTO reports (
                id, reporter_id, reporter_name, target_id, target_type,
                target_name, report_type, description, report_date, status,
                priority, admin_notes, action_taken, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *`,
            [
                newReportId,
                reportData.reporterId,
                reportData.reporterName,
                reportData.targetId,
                reportData.targetType,
                reportData.targetName,
                reportData.reportType,
                reportData.description,
                currentTimestamp,
                defaultStatus,
                defaultPriority,
                null,
                null,
                currentTimestamp,
                currentTimestamp,
            ]
        );

        const newReportEntity: ReportEntity = result.rows[0];
        await client.query('COMMIT');

        return newReportEntity;
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error creating report:', error);
        throw new Error('Failed to create report.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Fetches reports from the database, with optional filtering by status.
 * Accessible only by Admins.
 */
export const getReports = async (
    statusFilter?: ReportStatus
): Promise<ReportEntityFromService[]> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        let query = 'SELECT * FROM reports';
        const queryParams: any[] = [];

        if (statusFilter) {
            query += ' WHERE status = $1';
            queryParams.push(statusFilter);
        }

        query += ' ORDER BY created_at DESC'; // Order by newest reports first

        const result = await client.query<ReportEntity>(query, queryParams);
        return result.rows;
    } catch (error) {
        console.error('Error fetching reports:', error);
        throw new Error('Failed to fetch reports.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Updates an existing report's status, admin notes, or action taken.
 * Accessible only by Admins.
 */
export const updateReport = async (
    reportId: string,
    updates: UpdateReportRequestDTO
): Promise<ReportEntityFromService> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (updates.status !== undefined) {
            updateFields.push(`status = $${paramIndex++}`);
            updateValues.push(updates.status);
        }
        if (updates.adminNotes !== undefined) {
            updateFields.push(`admin_notes = $${paramIndex++}`);
            updateValues.push(updates.adminNotes);
        }
        if (updates.actionTaken !== undefined) {
            updateFields.push(`action_taken = $${paramIndex++}`);
            updateValues.push(updates.actionTaken);
        }

        if (updateFields.length === 0) {
            // If no fields to update, fetch the existing report and return it
            const existingReportResult = await client.query<ReportEntity>(
                'SELECT * FROM reports WHERE id = $1',
                [reportId]
            );
            if (existingReportResult.rows.length === 0) {
                throw new Error('Report not found.');
            }
            return existingReportResult.rows[0];
        }

        updateFields.push(`updated_at = NOW()`); // Always update `updated_at`

        const query = `
            UPDATE reports
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex++}
            RETURNING *;
        `;
        updateValues.push(reportId);

        const result = await client.query<ReportEntity>(query, updateValues);

        if (result.rows.length === 0) {
            throw new Error('Report not found or update failed.');
        }

        const updatedReportEntity: ReportEntity = result.rows[0];
        await client.query('COMMIT'); // Commit transaction

        return updatedReportEntity;
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK'); // Rollback on error
        }
        console.error(`Error updating report ${reportId}:`, error);
        throw new Error('Failed to update report.');
    } finally {
        if (client) {
            client.release();
        }
    }
};