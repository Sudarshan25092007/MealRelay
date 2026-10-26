import { Router } from 'express';
import * as donationController from './donation.controller.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import { requireRole, requireApprovedOrganization } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createDonationSchema,
  updateDonationSchema,
  queryDonationsSchema,
  verifyPickupSchema,
  cancelDonationSchema
} from './donation.schema.js';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole('DONOR'),
  requireApprovedOrganization('DONOR'),
  validate(createDonationSchema),
  donationController.createDonation
);

router.get(
  '/',
  optionalAuth,
  validate(queryDonationsSchema, 'query'),
  donationController.getDonations
);

router.get(
  '/:id',
  optionalAuth,
  donationController.getDonationById
);

router.patch(
  '/:id',
  requireAuth,
  validate(updateDonationSchema),
  donationController.updateDonation
);

// Phase 2: Claiming
router.post(
  '/:id/claim',
  requireAuth,
  requireRole('NGO'),
  requireApprovedOrganization('NGO'),
  donationController.claimDonation
);

// Phase 2: Pickup Verification
router.post(
  '/:id/verify-pickup',
  requireAuth,
  requireRole('NGO'),
  validate(verifyPickupSchema),
  donationController.verifyPickup
);

// Phase 2: Cancellation
router.post(
  '/:id/cancel',
  requireAuth,
  validate(cancelDonationSchema),
  donationController.cancelDonation
);

// Phase 2: Secure Pickup Code Retrieval (for Owning Donor)
router.get(
  '/:id/pickup-code',
  requireAuth,
  donationController.getPickupCode
);

// Phase 2: Audit History Timeline
router.get(
  '/:id/history',
  requireAuth,
  donationController.getDonationHistory
);

export default router;
