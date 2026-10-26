import { Router } from 'express';
import * as donationController from './donation.controller.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import { requireRole, requireApprovedOrganization } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createDonationSchema,
  updateDonationSchema,
  queryDonationsSchema
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

export default router;
