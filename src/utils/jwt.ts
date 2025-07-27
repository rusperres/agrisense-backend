import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';


export const signToken = (
  payload: string | object | Buffer,
  expiresIn: SignOptions['expiresIn'] = '7d'
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

export const verifyToken = (token: string): string | JwtPayload => {
  return jwt.verify(token, JWT_SECRET);
};
