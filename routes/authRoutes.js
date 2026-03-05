import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
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
 * Returns JWT token. Payload includes id, userType, role, organizationName.
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * GET /auth/me
 * Returns current user from JWT (id, userType, role, organizationName).
 */
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

export default router;
