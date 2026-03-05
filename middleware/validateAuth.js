import { AppError } from '../utils/AppError.js';

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name?.trim()) errors.push('Name is required');
  if (!email?.trim()) errors.push('Email is required');
  if (!password) errors.push('Password is required');
  if (password && password.length < 6) errors.push('Password must be at least 6 characters');

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email?.trim()) errors.push('Email is required');
  if (!password) errors.push('Password is required');

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }
  next();
};

export { validateRegister, validateLogin };
