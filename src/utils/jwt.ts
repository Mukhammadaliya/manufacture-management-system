import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  telegramId: string;
  role: string;
}

export const generateToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET || 'default_secret';
  
  return jwt.sign(
    payload, 
    secret, 
    { expiresIn: '7d' }
  );
};

export const verifyToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET || 'default_secret';
  return jwt.verify(token, secret) as TokenPayload;
};