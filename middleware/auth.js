import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';

/**
 * Verify JWT and attach user to req.user.
 * Expects Authorization: Bearer <token>
 *
 * Rejects if: token missing, token invalid, user not found, user status is suspended.
 * Attaches req.user = { id, userType, role, organizationName } from decoded JWT.
 */
export const protect = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('status');
    if (!user) {
      throw new AppError('User no longer exists.', 401);
    }

    if (user.status === 'suspended') {
      throw new AppError('Account is suspended.', 403);
    }

    req.user = {
      id: decoded.id,
      userType: decoded.userType || 'viewer',
      role: decoded.role || 'admin',
      organizationName: decoded.organizationName,
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token.', 401));
      return;
    }
    if (error.name === 'TokenExpiredError') {
      next(new AppError('Token expired.', 401));
      return;
    }
    next(error);
  }
};

/**
 * Restrict access to specified user types. Use after protect.
 * Creator permissions: create avatars, upload documents, manage avatars.
 * Viewer permissions: browse avatars, interact via /ask endpoint.
 *
 * @param  {...string} types - Allowed user types (e.g. 'creator', 'viewer')
 */
export const authorizeUserType = (...types) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }

  if (!types.includes(req.user.userType)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Insufficient permissions.',
    });
  }

  next();
};

/**
 * Restrict access to specified roles. Use after protect.
 * @param  {...string} roles - Allowed roles (e.g. 'admin', 'member')
 */
export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }

  if (!roles.includes(req.user.role)) {
    return next(new AppError('Access denied. Insufficient permissions.', 403));
  }

  next();
};
