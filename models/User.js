import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      maxlength: [64, 'Password cannot exceed 64 characters'],
      validate: {
        validator: (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/.test(v),
        message: 'Password must include uppercase, lowercase, number and special character (@$!%*?&)',
      },
      select: false,
    },
    userType: {
      type: String,
      enum: {
        values: ['creator', 'viewer'],
        message: 'User type must be either creator or viewer',
      },
      default: 'viewer',
    },
    organizationName: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.userType === 'creator') {
            return v != null && typeof v === 'string' && v.trim().length > 0;
          }
          return true;
        },
        message: 'Organization name is required when user type is creator',
      },
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'member'],
        message: 'Role must be either admin or member',
      },
      default: 'admin',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'suspended'],
        message: 'Status must be either active or suspended',
      },
      default: 'active',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

const User = mongoose.model('User', userSchema);

export default User;
