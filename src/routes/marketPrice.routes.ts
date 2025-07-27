import { Router } from 'express';
import * as MarketPriceController from '../controllers/marketPrice.controller';

const router = Router();

router.get('/', MarketPriceController.fetchMarketPrices);

export default router;