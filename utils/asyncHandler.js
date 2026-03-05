/**
 * Global async wrapper - prevents unhandled promise rejections in route handlers.
 * Wraps async route handlers and forwards errors to Express error middleware.
 *
 * @param {Function} fn - Async route handler (req, res, next) => Promise
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/user', asyncHandler(async (req, res) => {
 *   const user = await User.findById(req.params.id);
 *   res.json(user);
 * }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
