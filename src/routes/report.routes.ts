import { Router } from 'express';
import * as ReportController from '../controllers/report.controller';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../types/enums';
import { validateReportStatusUpdate, validateCreateReport } from '../middlewares/validate.middleware';

const router = Router();

// Route to get all reports (or filtered by status)
// Only accessible by Admins
router.get(
    '/admin/reports',
    authenticateUser,
    authorizeRoles([UserRole.Admin]), // Ensure only admins can access this
    ReportController.getReports
);

// Route to update a specific report's status (warn, suspend, dismiss)
// Only accessible by Admins
router.patch(
    '/admin/reports/:reportId',
    authenticateUser,
    authorizeRoles([UserRole.Admin]), // Ensure only admins can access this
    validateReportStatusUpdate, // Middleware to validate the incoming update data
    ReportController.updateReportStatus
);

// Potentially, a route for users to create a report
// This would be for buyers/sellers to report other users/crops/messages
router.post(
    '/reports',
    authenticateUser, // User must be logged in to create a report
    validateCreateReport, // You'd need a middleware to validate the creation DTO
    ReportController.createReport // We will define this next
);


export default router;