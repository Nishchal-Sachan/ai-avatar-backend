import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../middleware/schemas.js';

const router = Router();

/**
 * POST /auth/register
 *
 * Creator registration: body must include userType: "creator" and organizationName.
 * Creators can: create avatars, upload documents, manage avatars.
 *
 * Viewer registration: body includes userType: "viewer"; organizationName is ignored.
 * Viewers can: browse avatars, interact with avatars via /ask endpoint.
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * POST /auth/login
 * Returns JWT token. Payload includes id, userType, role.
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * GET /auth/me
 * Returns current user from JWT (id, userType, role).
 */
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

/**
 * POST /auth/send-otp
 * Generates and sends OTP to creator email
 */
router.post('/send-otp', protect, authController.sendOtp);

/**
 * POST /auth/verify-otp
 * Verifies the OTP sent to creator email
 */
router.post('/verify-otp', protect, authController.verifyOtp);

/**
 * POST /auth/forgot-password
 * Sends a reset OTP to email
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * POST /auth/verify-reset-otp
 * Verifies reset OTP
 */
router.post('/verify-reset-otp', authController.verifyResetOtp);

/**
 * POST /auth/reset-password
 * Resets the password
 */
router.post('/reset-password', authController.resetPassword);

export default router;
