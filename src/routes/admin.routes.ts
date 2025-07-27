// src/routes/admin.routes.ts
import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller'; // Assuming your admin controller
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware'; // For authentication and role-based authorization
import {
    validateApproveApplication, // You'll need to create these validation middlewares
    validateRejectApplication,
    validateSuspendUser,
} from '../middlewares/validate.middleware'; // Re-using or creating new validation middlewares
import { UserRole } from '../types/enums'; // Assuming you have an enums file for UserRole

const router = Router();

// Middleware to ensure only authenticated Admins can access these routes
// This assumes authenticateUser adds the user's role to req.user (e.g., req.user.role)
// and authorizeRoles checks if req.user.role includes UserRole.Admin
router.use(authenticateUser, authorizeRoles([UserRole.Admin]));

// --- Verification Applications ---
// GET /api/admin/applications - Fetch all verification applications
router.get('/applications', AdminController.getApplications);

// PATCH /api/admin/applications/:applicationId/approve - Approve a verification application
router.patch(
    '/applications/:applicationId/approve',
    validateApproveApplication, // Validate notes (optional for approval)
    AdminController.approveApplication
);

// PATCH /api/admin/applications/:applicationId/reject - Reject a verification application
router.patch(
    '/applications/:applicationId/reject',
    validateRejectApplication, // Validate notes (required for rejection)
    AdminController.rejectApplication
);

// --- User Management ---
// GET /api/admin/users - Fetch all users
router.get('/users', AdminController.getUsers);

// PATCH /api/admin/users/:userId/suspend - Suspend a user
router.patch(
    '/users/:userId/suspend',
    validateSuspendUser, // Validate reason (required for suspension)
    AdminController.suspendUser
);

export default router;