import jwt from 'jsonwebtoken';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

import { generateToken, verifyToken } from '../../utils/jwt';

describe('JWT Utils Tests', () => {
  const mockPayload = {
    userId: 'user-123',
    telegramId: '123456789',
    role: 'DISTRIBUTOR' as const,
  };
  const mockToken = 'mock-jwt-token';
  const mockSecret = 'test-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = mockSecret;
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate JWT token with complete payload', () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = generateToken(mockPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        mockSecret,
        { expiresIn: '7d' } // 7 days
      );

      expect(token).toBe(mockToken);
    });

    it('should use default expiration of 7 days', () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      generateToken(mockPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        { expiresIn: '7d' }
      );
    });

    it('should work with different roles', () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const producerPayload = {
        userId: 'user-456',
        telegramId: '987654321',
        role: 'PRODUCER' as const,
      };

      generateToken(producerPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        producerPayload,
        mockSecret,
        { expiresIn: '7d' }
      );
    });

    it('should work with admin role', () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const adminPayload = {
        userId: 'admin-1',
        telegramId: '111111111',
        role: 'ADMIN' as const,
      };

      generateToken(adminPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        adminPayload,
        mockSecret,
        { expiresIn: '7d' }
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode JWT token', () => {
      const mockDecoded = mockPayload;
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const decoded = verifyToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, mockSecret);
      expect(decoded).toEqual(mockDecoded);
    });

    it('should throw error for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      expect(() => verifyToken(mockToken)).toThrow('jwt expired');
    });

    it('should return decoded payload with all fields', () => {
      const mockDecoded = mockPayload;
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const decoded = verifyToken(mockToken);

      expect(decoded).toHaveProperty('userId', 'user-123');
      expect(decoded).toHaveProperty('telegramId', '123456789');
      expect(decoded).toHaveProperty('role', 'DISTRIBUTOR');
    });

    it('should handle malformed token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      expect(() => verifyToken('malformed.token')).toThrow('jwt malformed');
    });
  });
});