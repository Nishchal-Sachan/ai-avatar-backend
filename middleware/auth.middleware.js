import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

/**
 * Verify JWT and attach user to req.user.
 * Expects Authorization: Bearer <token>
 *
 * Rejects: missing token, invalid token, user not found, suspended users.
 * Attaches req.user = { id, userType, role } from decoded JWT.
 */
export const protect = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      throw new AppError("Missing token", 401, "AUTH_REQUIRED");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("status");
    if (!user) {
      throw new AppError("Invalid token", 401, "AUTH_INVALID");
    }

    if (user.status === "suspended") {
      throw new AppError("Account is suspended", 403, "ACCESS_DENIED");
    }

    req.user = {
      id: decoded.id,
      userType: decoded.userType || "viewer",
      role: decoded.role || "admin",
    };
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      next(new AppError("Invalid token", 401, "AUTH_INVALID"));
      return;
    }
    if (error.name === "TokenExpiredError") {
      next(new AppError("Token expired", 401, "AUTH_EXPIRED"));
      return;
    }
    next(error);
  }
};

/**
 * Restrict access to specified user types. Use after protect.
 *
 * @param  {...string} types - Allowed user types (e.g. "creator", "viewer")
 */
export const authorizeUserType = (...types) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Missing token", 401, "AUTH_REQUIRED"));
  }

  if (!types.includes(req.user.userType)) {
    return next(new AppError("Access denied", 403, "ACCESS_DENIED"));
  }

  next();
};

/**
 * Restrict access to specified roles. Use after protect.
 *
 * @param  {...string} roles - Allowed roles (e.g. "admin", "member")
 */
export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Missing token", 401, "AUTH_REQUIRED"));
  }

  if (!roles.includes(req.user.role)) {
    return next(new AppError("Access denied", 403, "ACCESS_DENIED"));
  }

  next();
};

/**
 * Require user to be a verified creator
 */
export const requireVerifiedCreator = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError("Missing token", 401, "AUTH_REQUIRED"));
    }

    if (req.user.userType !== "creator") {
      return next(new AppError("Access denied, must be creator", 403, "ACCESS_DENIED"));
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.isVerified) {
      return next(new AppError("Account not verified", 403, "NOT_VERIFIED"));
    }

    next();
  } catch (error) {
    next(error);
  }
};
