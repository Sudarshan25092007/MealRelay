import { Router } from 'express';
import * as orgController from './organization.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorize.js';

const router = Router();

router.get('/:id', orgController.getOrganization);

// Admin-only route to update approval status
router.patch(
  '/:id/approval',
  requireAuth,
  requireRole('ADMIN'),
  orgController.updateApproval
);

export default router;
