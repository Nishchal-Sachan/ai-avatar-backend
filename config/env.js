import dotenv from 'dotenv';
import Joi from 'joi';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.string().default('3000'),
  MONGODB_URI: Joi.string().required().messages({ 'any.required': 'MONGODB_URI is required' }),
  JWT_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_SECRET is required',
    'string.min': 'JWT_SECRET must be at least 32 characters',
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').optional(),
  RATE_LIMIT_MAX: Joi.string().pattern(/^\d+$/).optional(),
  GROQ_API_KEY: Joi.string().optional().allow(''),
  HF_API_KEY: Joi.string().optional().allow(''),
  OPENAI_API_KEY: Joi.string().optional().allow(''),
  ELEVENLABS_API_KEY: Joi.string().optional().allow(''),
  PINECONE_API_KEY: Joi.string().optional().allow(''),
  PINECONE_INDEX: Joi.string().optional().allow(''),
  CORS_ORIGIN: Joi.string().trim().optional().allow(''),
}).unknown(true);

function validateEnv() {
  const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || '3000',
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    LOG_LEVEL: process.env.LOG_LEVEL,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    HF_API_KEY: process.env.HF_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX: process.env.PINECONE_INDEX,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };

  const { error, value } = envSchema.validate(env, { abortEarly: false });

  if (error) {
    const messages = error.details.map((d) => d.message).join('\n  - ');
    console.error('Environment validation failed:\n  -', messages);
    console.error('\nCreate a .env file with the required variables. See .env.example');
    process.exit(1);
  }

  return value;
}

const env = validateEnv();

export default env;
