import { Router } from 'express';
import * as FarmerModerationController from '../controllers/farmerModeration.controller'; // We'll create this
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../types/enums';
import { validateGetFarmerProfiles, validateFarmerId, validateRejectFarmer } from '../middlewares/validate.middleware'; // We'll add this validator

const router = Router();

// Route to fetch all farmer profiles, with optional filters
// Only Admins should be able to fetch all farmer profiles for moderation purposes.
router.use(authenticateUser, authorizeRoles([UserRole.Admin]));

// Fetch farmer profiles (e.g., for moderation dashboard)
router.get('/farmers', validateGetFarmerProfiles, FarmerModerationController.getFarmerProfiles);

// Approve a farmer profile
router.patch('/farmers/:id/approve', validateFarmerId, FarmerModerationController.approveFarmer);

// Reject a farmer profile
router.patch('/farmers/:id/reject', validateFarmerId, validateRejectFarmer, FarmerModerationController.rejectFarmer);

export default router;