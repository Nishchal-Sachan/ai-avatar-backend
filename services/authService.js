import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

/**
 * Register a new user.
 * Creator registration: requires organizationName. Creators automatically become organization admin.
 * Viewer registration: organizationName is ignored.
 * @param {Object} userData - { name, email, password, userType, organizationName? }
 * @returns {Promise<Object>} { user, token }
 */
export const registerUser = async (userData) => {
  const { name, email, password, userType = 'viewer', organizationName } = userData;

  if (userType === 'creator' && (!organizationName || !organizationName.trim())) {
    throw new AppError('Organization name is required when user type is creator', 400, 'VALIDATION_ERROR');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('User already exists with this email', 409, 'DUPLICATE_RESOURCE');
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    userType,
    organizationName: userType === 'creator' ? organizationName?.trim() : null,
    role: 'admin',
  });

  const token = jwt.sign(
    {
      id: user._id,
      userType: user.userType,
      role: user.role,
      organizationName: user.organizationName,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const userObj = user.toObject();
  delete userObj.password;

  return { user: userObj, token };
};

/**
 * Authenticate user and return JWT.
 * Login does NOT assign roles - uses stored user.role and user.userType.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} { user, token }
 */
export const loginUser = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +status');

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'AUTH_INVALID');
  }

  if (user.status === 'suspended') {
    throw new AppError('Account is suspended.', 403, 'ACCESS_DENIED');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401, 'AUTH_INVALID');
  }

  const token = jwt.sign(
    {
      id: user._id,
      userType: user.userType || 'viewer',
      role: user.role || 'admin',
      organizationName: user.organizationName,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const userObj = user.toObject();
  delete userObj.password;

  return { user: userObj, token };
};
