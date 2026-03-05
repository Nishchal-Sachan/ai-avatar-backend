/**
 * Joi validation schemas.
 */
import Joi from "joi";

export const registerSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required().messages({
      "string.empty": "Name is required",
    }),
    email: Joi.string().email().trim().lowercase().required().messages({
      "string.empty": "Email is required",
      "string.email": "Please provide a valid email",
    }),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/)
      .required()
      .messages({
        "string.empty": "Password is required",
        "string.min": "Password must be at least 8 characters",
        "string.pattern.base":
          "Password must contain at least one letter and one number",
      }),
    userType: Joi.string().valid("creator", "viewer").default("viewer"),
    organizationName: Joi.string()
      .trim()
      .when("userType", {
        is: "creator",
        then: Joi.required().messages({
          "any.required":
            "Organization name is required when user type is creator",
        }),
        otherwise: Joi.optional().strip(),
      }),
  }),
};

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().trim().lowercase().required().messages({
      "string.empty": "Email is required",
    }),
    password: Joi.string().required().messages({
      "string.empty": "Password is required",
    }),
  }),
};

export const askSchema = {
  body: Joi.object({
    text: Joi.string().trim().max(10000).optional().allow(""),

    avatarId: Joi.string().trim().max(100).optional(),

    targetLanguage: Joi.string()
      .valid("en", "hi", "es", "fr")
      .default("en")
      .optional(),

    temperature: Joi.number().min(0).max(1).optional(),

    maxTokens: Joi.number().integer().min(1).max(4096).optional(),

    topK: Joi.number().integer().min(1).max(20).optional(),

    streamAudio: Joi.boolean().optional(),
  }).optional(),
};

export const createAvatarSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    persona: Joi.string().trim().max(1000).optional(),
    defaultLanguage: Joi.string().trim().max(20).optional(),
    voiceId: Joi.string().trim().max(100).optional(),
    appearance: Joi.object({
      eyeColor: Joi.string().optional(),
      skinTone: Joi.string().optional(),
      hairStyle: Joi.string().optional(),
      hairColor: Joi.string().optional(),
      outfit: Joi.string().optional(),
      accessories: Joi.array().items(Joi.string()).optional(),
      height: Joi.number().optional(),
    }).optional(),
  }),
};

export const updateAvatarSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    persona: Joi.string().trim().max(1000).optional(),
    defaultLanguage: Joi.string().trim().max(20).optional(),
    voiceId: Joi.string().trim().max(100).optional(),
    appearance: Joi.object().optional(),
  }),
};
