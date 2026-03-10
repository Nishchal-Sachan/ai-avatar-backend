/**
 * Avatar service - create avatars (creator only), list avatars, validate ownership.
 */
import Avatar from '../models/Avatar.js';
import { AppError } from '../utils/AppError.js';

/**
 * List all avatars. Used by both creators and viewers for browsing.
 */
export async function listAvatars() {
  return Avatar.find().sort({ createdAt: -1 });
}

/**
 * Create a new avatar.
 */
export async function createAvatar(data) {
  return Avatar.create(data);
}

/**
 * Update avatar by id. Only the creator can update.
 * Merges appearance fields (does not replace entire appearance object).
 */
export async function updateAvatar(avatarId, data, userId) {
  const updateData = { ...data };

  if (data.appearance && typeof data.appearance === "object") {
    delete updateData.appearance;
    for (const [key, value] of Object.entries(data.appearance)) {
      updateData[`appearance.${key}`] = value;
    }
  }

  const avatar = await Avatar.findOneAndUpdate(
    { _id: avatarId, createdBy: userId },
    updateData,
    { new: true }
  );

  if (!avatar) {
    throw new AppError("Avatar not found", 404, "AVATAR_NOT_FOUND");
  }

  return avatar;
}

/**
 * Delete avatar by id. Only the creator can delete.
 */
export async function deleteAvatar(avatarId, userId) {
  const avatar = await Avatar.findOneAndDelete({
    _id: avatarId,
    createdBy: userId,
  });

  if (!avatar) {
    throw new AppError("Avatar not found", 404, "AVATAR_NOT_FOUND");
  }

  return true;
}

/**
 * Validate document upload: only avatar creator (creator userType) can upload.
 * When avatarId provided: user must be the avatar creator.
 * When no avatarId: creator can upload (personal docs).
 * @param {string} [avatarId] - Avatar _id (optional)
 * @param {Object} user - { id, userType, role }
 * @throws {AppError} if not allowed
 */
export async function validateDocumentUploadAccess(avatarId, user) {
  if (user.userType !== 'creator') {
    throw new AppError('Only creators can upload documents.', 403, 'ACCESS_DENIED');
  }

  if (!avatarId?.trim()) {
    return;
  }

  const avatar = await Avatar.findById(avatarId.trim());
  if (!avatar) {
    throw new AppError('Avatar not found.', 404, 'AVATAR_NOT_FOUND');
  }

  const isCreator = avatar.createdBy.toString() === user.id.toString();

  if (!isCreator) {
    throw new AppError('Only the avatar creator can upload documents to this avatar.', 403, 'ACCESS_DENIED');
  }
}
