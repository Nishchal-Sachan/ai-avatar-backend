import crypto from 'crypto';

/**
 * Generate a 6-digit OTP
 * @returns {string} 6-digit plain text OTP
 */
export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hash an OTP
 * @param {string} otp 
 * @returns {string} Hashed OTP
 */
export const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};
