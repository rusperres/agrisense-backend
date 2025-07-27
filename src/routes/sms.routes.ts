import { Router } from 'express';
import * as SMSController from '../controllers/sms.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Public: Receive and log SMS (e.g. webhook or 3rd party integration)
router.post('/log', SMSController.logSMS);

// Protected routes (only logged-in users can view logs)
router.use(authenticate);

router.get('/', SMSController.getAllSMSLogs);
router.get('/user/:id', SMSController.getSMSLogsByUser);

export default router;
