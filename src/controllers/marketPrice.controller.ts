import { Request, Response, NextFunction } from 'express';
import * as MarketPriceService from '../services/marketPrice.service';

export const fetchMarketPrices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const marketPrices = await MarketPriceService.fetchMarketPrices();
        res.status(200).json(marketPrices);
    } catch (error) {
        next(error);
    }
};