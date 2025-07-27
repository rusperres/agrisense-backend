import { Router } from 'express';
import * as CropListingController from '../controllers/cropListing.controller';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../types/enums';
import { validateGetCropListings, validateApproveCrop, validateRejectCrop, validateFlagCrop } from '../middlewares/validate.middleware'; // We'll add this validator

const router = Router();

// Route to fetch all crop listings, with optional filters
// Only admins or moderators should likely access ALL crop listings for moderation
// Consider if regular users should also be able to browse APPROVED listings.
// For moderation purposes, we assume Admin or Moderator role.
router.get(
    '/',
    authenticateUser,
    authorizeRoles([UserRole.Admin]),
    validateGetCropListings,
    CropListingController.fetchCropListings
);

router.patch(
    '/:cropId/approve',
    authenticateUser,
    authorizeRoles([UserRole.Admin]), // Only Admins/Moderators should approve
    validateApproveCrop,
    CropListingController.approveCrop
);

router.patch(
    '/:cropId/reject',
    authenticateUser,
    authorizeRoles([UserRole.Admin]), // Only Admins/Moderators should reject
    validateRejectCrop, // New validator middleware
    CropListingController.rejectCrop // New controller function
);

router.patch(
    '/:cropId/flag',
    authenticateUser,
    authorizeRoles([UserRole.Admin]), // Only Admins/Moderators should flag
    validateFlagCrop, // New validator middleware
    CropListingController.flagCrop
);

export default router;