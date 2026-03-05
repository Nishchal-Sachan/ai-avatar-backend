import { Router } from "express";
import * as avatarController from "../controllers/avatarController.js";
import { protect, authorizeUserType } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createAvatarSchema,
  updateAvatarSchema,
} from "../middleware/schemas.js";

const router = Router();

/**
 * GET /avatars
 * Both creators and viewers can browse avatars. Requires protect only.
 */
router.get("/", protect, avatarController.list);

/**
 * POST /avatars
 * Creator only. Viewers receive 403.
 */
router.post(
  "/",
  protect,
  authorizeUserType("creator"),
  validate(createAvatarSchema),
  avatarController.create
);

/**
 * PATCH /avatars/:id
 * Creator only. Update avatar by id.
 */
router.patch(
  "/:id",
  protect,
  authorizeUserType("creator"),
  validate(updateAvatarSchema),
  avatarController.update
);

/**
 * DELETE /avatars/:id
 * Creator only. Delete avatar by id.
 */
router.delete(
  "/:id",
  protect,
  authorizeUserType("creator"),
  avatarController.remove
);

export default router;
