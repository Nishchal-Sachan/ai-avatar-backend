import Avatar from "../models/Avatar.js";
import AppError from "../utils/AppError.js";

/**
 * List all avatars. Used by both creators and viewers for browsing.
 */
export async function listAvatars() {
  return Avatar.find().sort({ createdAt: -1 });
}

/**
 * Create a new avatar.
 * @param {Object} data - { name, persona?, defaultLanguage?, voiceId?, appearance?, createdBy }
 * @throws {AppError} if name or createdBy missing
 */
export async function createAvatar(data) {
  if (!data.name?.trim()) {
    throw new AppError("Name is required", 400, "VALIDATION_ERROR");
  }
  if (!data.createdBy) {
    throw new AppError("createdBy is required", 400, "VALIDATION_ERROR");
  }

  return Avatar.create({
    name: data.name.trim(),
    persona: data.persona?.trim(),
    defaultLanguage: data.defaultLanguage?.trim(),
    voiceId: data.voiceId?.trim(),
    appearance: data.appearance && typeof data.appearance === "object" ? data.appearance : {},
    createdBy: data.createdBy,
  });
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
 */
export async function validateDocumentUploadAccess(avatarId, user) {
  if (user.userType !== "creator") {
    throw new AppError("Only creators can upload documents.", 403, "ACCESS_DENIED");
  }

  if (!avatarId?.trim()) {
    return;
  }

  const avatar = await Avatar.findById(avatarId.trim());
  if (!avatar) {
    throw new AppError("Avatar not found.", 404, "AVATAR_NOT_FOUND");
  }

  const isCreator = avatar.createdBy.toString() === user.id.toString();

  if (!isCreator) {
    throw new AppError(
      "Only the avatar creator can upload documents to this avatar.",
      403,
      "ACCESS_DENIED"
    );
  }
}
