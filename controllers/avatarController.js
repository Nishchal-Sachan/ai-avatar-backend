import * as avatarService from "../services/avatarService.js";

/**
 * List avatars. Both creators and viewers can browse.
 * GET /api/v1/avatars
 */
export const list = async (req, res, next) => {
  try {
    const avatars = await avatarService.listAvatars();
    res.status(200).json({
      success: true,
      data: { avatars },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create avatar. Creator only.
 * POST /api/v1/avatars
 */
export const create = async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

/**
 * Update avatar. Creator only.
 * PATCH /api/v1/avatars/:id
 */
export const update = async (req, res, next) => {
  try {
    const avatar = await avatarService.updateAvatar(
      req.params.id,
      req.body,
      req.user.id
    );

    res.json({
      success: true,
      data: { avatar },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete avatar. Creator only.
 * DELETE /api/v1/avatars/:id
 */
export const remove = async (req, res, next) => {
  try {
    await avatarService.deleteAvatar(req.params.id, req.user.id);

    res.json({
      success: true,
      message: "Avatar deleted",
    });
  } catch (error) {
    next(error);
  }
};
