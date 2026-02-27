import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller'; 
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware';
import {
    validateApproveApplication,
    validateRejectApplication,
    validateSuspendUser,
} from '../middlewares/validate.middleware'; 
import { UserRole } from '../types/enums'; 
const router = Router();

router.use(authenticateUser, authorizeRoles([UserRole.Admin]));
router.get('/applications', AdminController.getApplications);

router.patch(
    '/applications/:applicationId/approve',
    validateApproveApplication, 
    AdminController.approveApplication
);

router.patch(
    '/applications/:applicationId/reject',
    validateRejectApplication,
    AdminController.rejectApplication
);
router.get('/users', AdminController.getUsers);

router.patch(
    '/users/:userId/suspend',
    validateSuspendUser, 
    AdminController.suspendUser
);

export default router;
