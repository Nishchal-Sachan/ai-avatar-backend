/**
 * Normalizes avatar create request body before validation.
 * Flattens nested structures (avatar.name, data.name) into req.body.name
 * so the name is preserved regardless of client request format.
 */
export function normalizeAvatarBody(req, res, next) {
  const b = req.body || {};
  const name =
    b.name ??
    b.avatarName ??
    b.avatar?.name ??
    b.data?.attributes?.name ??
    b.data?.name;
  if (name != null && typeof name === 'string') {
    req.body = { ...b, name: name.trim() };
  }
  next();
}
