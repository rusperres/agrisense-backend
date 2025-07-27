import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller';
import { validateRegister, validateLogin, validateUpdateProfile, validateUpdateUserLocation, validateUpdateEWalletDetails } from '../middlewares/validate.middleware';
import { authenticateUser } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', validateRegister, AuthController.register);
router.post('/login', validateLogin, AuthController.login); 
router.patch('/profile', authenticateUser, validateUpdateProfile, AuthController.updateProfile);
router.patch('/location', authenticateUser, validateUpdateUserLocation, AuthController.updateUserLocation); 
router.patch('/e-wallet', authenticateUser, validateUpdateEWalletDetails, AuthController.updateUserEWalletDetails);

export default router;
