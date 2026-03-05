import * as authService from '../services/authService.js';

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
export const register = async (req, res, next) => {
  try {
    const { user, token } = await authService.registerUser(req.body);
    res.status(201).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user and return JWT.
 * POST /api/v1/auth/login
 *
 * Login does NOT assign roles. JWT payload includes id, userType, role, organizationName.
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.loginUser(email, password);
    res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};
