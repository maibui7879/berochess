import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  DATABASE_POOL_URL: Joi.string().uri().allow('', null).optional(),
  DATABASE_SSL: Joi.string().valid('true', 'false').default('true'),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  LIVEKIT_URL: Joi.string().allow('', null).optional(),
  LIVEKIT_API_KEY: Joi.string().allow('', null).optional(),
  LIVEKIT_API_SECRET: Joi.string().allow('', null).optional(),
  CORS_ORIGIN: Joi.string().allow('', null).optional(),
  SENTRY_DSN: Joi.string().allow('', null).optional(),
  SENTRY_TRACES_RATE: Joi.number().min(0).max(1).default(0).optional(),
});
