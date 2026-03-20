import * as avatarService from "../services/avatarService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";

/**
 * List avatars. Both creators and viewers can browse.
 * GET /api/v1/avatars
 */
export const list = asyncHandler(async (req, res) => {
  const avatars = await avatarService.listAvatars();
  res.status(200).json({
    success: true,
    data: { avatars },
  });
});

/**
 * Create avatar. Creator only.
 * POST /api/v1/avatars
 */
export const create = asyncHandler(async (req, res) => {
  console.log("Creating avatar with data:", req.body);
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  const avatar = await avatarService.createAvatar({
    name: req.body.name,
    persona: req.body.persona,
    defaultLanguage: req.body.defaultLanguage,
    voiceId: req.body.voiceId,
    appearance: req.body.appearance,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    data: { avatar },
  });
});

/**
 * Update avatar. Creator only.
 * PATCH /api/v1/avatars/:id
 */
export const update = asyncHandler(async (req, res) => {
  const avatar = await avatarService.updateAvatar(
    req.params.id,
    req.body,
    req.user.id
  );

  res.json({
    success: true,
    data: { avatar },
  });
});

/**
 * Delete avatar. Creator only.
 * DELETE /api/v1/avatars/:id
 */
export const remove = asyncHandler(async (req, res) => {
  await avatarService.deleteAvatar(req.params.id, req.user.id);

  res.json({
    success: true,
    message: "Avatar deleted",
  });
});
