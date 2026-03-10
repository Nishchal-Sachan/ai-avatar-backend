/**
 * Joi validation middleware - validates req.body, req.query, req.params.
 * @param {Object} schemas - { body?, query?, params? }
 * @param {Object} [options] - { stripUnknown?: boolean } - default true for body
 */
import AppError from "../utils/AppError.js";

export function validate(schemas, options = {}) {
  const stripUnknown = options.stripUnknown !== false;
  return (req, res, next) => {
    try {
      const errors = [];

      if (schemas.body) {
        const { error, value } = schemas.body.validate(req.body || {}, {
          abortEarly: false,
          stripUnknown,
        });
        if (error) {
          errors.push(...error.details.map((d) => d.message));
        } else {
          req.body = value;
        }
      }

      if (schemas.query) {
        const { error } = schemas.query.validate(req.query || {}, {
          abortEarly: false,
        });
        if (error) {
          errors.push(...error.details.map((d) => d.message));
        }
      }

      if (schemas.params) {
        const { error } = schemas.params.validate(req.params || {}, {
          abortEarly: false,
        });
        if (error) {
          errors.push(...error.details.map((d) => d.message));
        }
      }

      if (errors.length > 0) {
        return next(new AppError(errors.join(". "), 400, "VALIDATION_ERROR"));
      }

      next();
    } catch (err) {
      next(new AppError(err.message || "Validation failed", 400, "VALIDATION_ERROR"));
    }
  };
}
