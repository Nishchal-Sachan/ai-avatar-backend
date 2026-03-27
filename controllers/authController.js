import * as authService from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Register a new user.
 * POST /api/v1/auth/register
 *
 * Creator registration: body must include userType: "creator" and organizationName.
 * Viewer registration: body includes userType: "viewer"; organizationName is ignored.
 *
 * Request body: { name, email, password, userType, organizationName? }
 * Returns JWT token after successful registration.
 */
export const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.registerUser(req.body);
  res.status(201).json({
    success: true,
    token,
    user,
  });
});

/**
 * Login user and return JWT.
 * POST /api/v1/auth/login
 *
 * Login does NOT assign roles. JWT payload includes id, userType, role, organizationName.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await authService.loginUser(email, password);
  res.status(200).json({
    success: true,
    token,
    user,
  });
});

/**
 * Send OTP for creator verification
 * POST /api/v1/auth/send-otp
 */
export const sendOtp = asyncHandler(async (req, res) => {
  await authService.sendOtp(req.user.id);
  res.status(200).json({
    success: true,
    message: "OTP sent to email",
  });
});

/**
 * Verify OTP for creator verification
 * POST /api/v1/auth/verify-otp
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  await authService.verifyOtp(req.user.id, otp);
  res.status(200).json({
    success: true,
    message: "Account verified",
  });
});
