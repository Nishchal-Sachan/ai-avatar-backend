import nodemailer from "nodemailer";

const createTransporter = () => {
  return nodemailer.createTransport({
    // Using Gmail for default config, though ideally configured through env variables for flexibility
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send OTP to the given email address
 * @param {string} to
 * @param {string} otp
 */
export const sendOTPEmail = async (to, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"AI Avatar Platform" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify Your Account – AI Avatar Platform",

    text: `Hello,

Your verification code is: ${otp}

This code will expire in 10 minutes.

Do not share this code with anyone.

If you did not request this, please ignore this email.
`,

    html: `
  <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 25px; border-radius: 10px; text-align: center;">

      <h2 style="margin-bottom: 10px; color: #333;">AI Avatar Platform</h2>
      <p style="color: #666; margin-bottom: 20px;">Email Verification</p>

      <p style="font-size: 16px; color: #333;">Hello,</p>
      <p style="font-size: 15px; color: #555;">
        Thank you for registering. Please use the OTP below to verify your account.
      </p>

      <div style="
        margin: 25px 0;
        padding: 15px;
        background: #f0f4ff;
        border-radius: 8px;
        font-size: 28px;
        font-weight: bold;
        letter-spacing: 4px;
        color: #2b6cff;
      ">
        ${otp}
      </div>

      <p style="font-size: 14px; color: #777;">
        ⏳ This OTP will expire in 10 minutes
      </p>

      <p style="font-size: 13px; color: #999; margin-top: 20px;">
        ⚠️ Do not share this code with anyone.
      </p>

      <p style="font-size: 12px; color: #aaa; margin-top: 20px;">
        If you did not request this, please ignore this email.
      </p>

    </div>
  </div>
  `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${to}`);
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw new Error("Failed to send OTP email");
  }
};
