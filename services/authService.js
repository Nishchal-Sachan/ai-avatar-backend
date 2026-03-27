import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import { generateOTP, hashOTP } from "../utils/otp.util.js";
import { sendOTPEmail } from "./email.service.js";

/**
 * Register a new user.
 * Creator: requires organizationName.
 * Viewer: organizationName is ignored.
 *
 * @param {Object} userData - { name, email, password, userType, organizationName? }
 * @returns {Promise<Object>} { user, token }
 */
export const registerUser = async (userData) => {
  const { name, email, password, userType = "viewer", organizationName } = userData;

  if (userType === "creator" && (!organizationName || !organizationName.trim())) {
    throw new AppError(
      "Organization name is required when user type is creator",
      400,
      "VALIDATION_ERROR"
    );
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError("User already exists with this email", 409, "DUPLICATE_RESOURCE");
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    userType,
    organizationName: userType === "creator" ? organizationName?.trim() : null,
    role: "admin",
  });

  const token = jwt.sign(
    {
      id: user._id,
      userType: user.userType,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  const userObj = user.toObject();
  delete userObj.password;

  return { user: userObj, token };
};

/**
 * Authenticate user and return JWT.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} { user, token }
 */
export const loginUser = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password +status"
  );

  if (!user) {
    throw new AppError("Invalid credentials", 401, "AUTH_INVALID");
  }

  if (user.status === "suspended") {
    throw new AppError("Account is suspended", 403, "ACCESS_DENIED");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401, "AUTH_INVALID");
  }

  const token = jwt.sign(
    {
      id: user._id,
      userType: user.userType || "viewer",
      role: user.role || "admin",
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  const userObj = user.toObject();
  delete userObj.password;

  return { user: userObj, token };
};

export const sendOtp = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  if (user.userType !== "creator") throw new AppError("Only creators can verify", 403, "NOT_ALLOWED");
  if (user.isVerified) throw new AppError("Already verified", 400, "ALREADY_VERIFIED");

  const otp = generateOTP();
  const hashedOtp = hashOTP(otp);

  console.log(`OTP generated for user ${userId}`);

  user.otp = hashedOtp;
  // expiry: 5 minutes
  user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
  
  await user.save({ validateBeforeSave: false });

  await sendOTPEmail(user.email, otp);
};

export const verifyOtp = async (userId, otp) => {
  if (!otp || typeof otp !== "string" || otp.length !== 6) {
    throw new AppError("OTP must be 6 digits", 400, "INVALID_OTP");
  }

  const user = await User.findById(userId).select("+otp +otpExpires");
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  if (user.userType !== "creator") throw new AppError("Only creators can verify", 403, "NOT_ALLOWED");
  if (user.isVerified) throw new AppError("Already verified", 400, "ALREADY_VERIFIED");
  if (!user.otp || !user.otpExpires) throw new AppError("No OTP requested", 400, "NO_OTP");
  if (new Date() > user.otpExpires) {
    throw new AppError("Expired OTP", 400, "EXPIRED_OTP");
  }

  const hashedOtp = hashOTP(otp);
  if (user.otp !== hashedOtp) {
    console.log(`Failed verification attempt for user ${userId}`);
    throw new AppError("Invalid OTP", 400, "INVALID_OTP");
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;

  await user.save({ validateBeforeSave: false });
  console.log(`User ${userId} successfully verified`);
};
