import prisma from '../../config/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError
} from '../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';

export async function createDonation(donationData, user) {
  // 1. Verify user's organization is an approved DONOR
  if (!user.organization || user.organization.type !== 'DONOR') {
    throw new ForbiddenError('Only DONOR organizations can publish donations');
  }

  if (user.organization.approvalStatus !== 'APPROVED') {
    throw new ForbiddenError(
      `Your organization cannot publish donations while approval status is ${user.organization.approvalStatus}. Approval is required.`
    );
  }

  // 2. Validate pickup deadline is strictly in the future
  const pickupTime = new Date(donationData.pickupDeadline).getTime();
  const now = Date.now();
  if (pickupTime <= now) {
    throw new BadRequestError('Pickup deadline must be in the future');
  }

  // 3. Create donation tied to verified organization
  const donation = await prisma.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        donorOrganizationId: user.organization.id,
        title: donationData.title.trim(),
        description: donationData.description.trim(),
        quantity: donationData.quantity,
        unit: donationData.unit,
        foodType: donationData.foodType,
        preparedAt: new Date(donationData.preparedAt),
        consumeBy: new Date(donationData.consumeBy),
        pickupDeadline: new Date(donationData.pickupDeadline),
        status: 'OPEN'
      },
      include: {
        donorOrganization: {
          select: {
            id: true,
            name: true,
            locality: true,
            address: true
          }
        }
      }
    });

    await logAuditEvent({
      actorUserId: user.id,
      donationId: created.id,
      action: 'DONATION_CREATED',
      newStatus: 'OPEN',
      metadata: {
        title: created.title,
        quantity: created.quantity,
        unit: created.unit,
        foodType: created.foodType
      },
      tx
    });

    return created;
  });

  return donation;
}

export async function getDonations(query = {}, user = null) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const where = {};

  // Locality filter
  if (query.locality) {
    where.donorOrganization = {
      locality: {
        contains: query.locality.trim(),
        mode: 'insensitive'
      }
    };
  }

  // Food type filter
  if (query.foodType) {
    where.foodType = query.foodType;
  }

  // Active only filter
  if (query.activeOnly === 'true') {
    where.pickupDeadline = {
      gte: new Date()
    };
  }

  // Ownership and Visibility rules
  const isDonorViewingOwn = query.my === 'true' && user?.organization?.type === 'DONOR';

  if (isDonorViewingOwn) {
    where.donorOrganizationId = user.organization.id;
    if (query.status) {
      where.status = query.status;
    }
  } else {
    // Discovery feed (default for NGOs, public, or donors browsing general pool)
    if (query.status) {
      // If asking for a non-OPEN status without being owner, restrict to OPEN
      if (query.status !== 'OPEN' && user?.role !== 'ADMIN') {
        where.status = 'OPEN';
      } else {
        where.status = query.status;
      }
    } else {
      where.status = 'OPEN';
    }
  }

  const [total, donations] = await Promise.all([
    prisma.donation.count({ where }),
    prisma.donation.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { pickupDeadline: 'asc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        title: true,
        description: true,
        quantity: true,
        unit: true,
        foodType: true,
        preparedAt: true,
        consumeBy: true,
        pickupDeadline: true,
        status: true,
        createdAt: true,
        donorOrganization: {
          select: {
            id: true,
            name: true,
            locality: true,
            address: true
          }
        }
      }
    })
  ]);

  return {
    data: donations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

export async function getDonationById(id, user = null) {
  const donation = await prisma.donation.findUnique({
    where: { id },
    include: {
      donorOrganization: {
        select: {
          id: true,
          name: true,
          locality: true,
          address: true
        }
      },
      claimedByOrganization: {
        select: {
          id: true,
          name: true,
          locality: true
        }
      },
      auditEvents: {
        select: {
          id: true,
          action: true,
          previousStatus: true,
          newStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (!donation) {
    throw new NotFoundError('Donation not found');
  }

  // Access rules:
  // If OPEN -> visible to any authenticated user or approved organization
  // If not OPEN -> only owning donor, claiming NGO, or ADMIN can view
  if (donation.status !== 'OPEN') {
    const isOwner = user?.organizationId === donation.donorOrganizationId;
    const isClaimer = user?.organizationId === donation.claimedByOrganizationId;
    const isAdmin = user?.role === 'ADMIN';

    if (!isOwner && !isClaimer && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this private donation record');
    }
  }

  return donation;
}

export async function updateDonation(id, updateData, user) {
  // 1. Fetch current donation
  const existing = await prisma.donation.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Donation not found');
  }

  // 2. State restriction: Only OPEN donations may be modified
  if (existing.status !== 'OPEN') {
    throw new BadRequestError(`Cannot edit a donation with status '${existing.status}'. Only OPEN donations can be edited.`);
  }

  // 3. Ownership restriction: Only the owning donor organization (or admin) can update
  const isOwner = user?.organizationId === existing.donorOrganizationId;
  const isAdmin = user?.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to modify another organization\'s donation');
  }

  // 4. Validate timestamp consistency across existing + updated fields
  const prep = updateData.preparedAt ? new Date(updateData.preparedAt) : existing.preparedAt;
  const consume = updateData.consumeBy ? new Date(updateData.consumeBy) : existing.consumeBy;
  const pickup = updateData.pickupDeadline ? new Date(updateData.pickupDeadline) : existing.pickupDeadline;

  if (consume.getTime() <= prep.getTime()) {
    throw new BadRequestError('consumeBy must be later than preparedAt');
  }

  if (pickup.getTime() > consume.getTime()) {
    throw new BadRequestError('pickupDeadline cannot be later than consumeBy');
  }

  if (pickup.getTime() < prep.getTime()) {
    throw new BadRequestError('pickupDeadline cannot be earlier than preparedAt');
  }

  // Safe data mapping - strictly prevents changing donor, claimer, status, or verification
  const safeUpdates = {};
  if (updateData.title !== undefined) safeUpdates.title = updateData.title.trim();
  if (updateData.description !== undefined) safeUpdates.description = updateData.description.trim();
  if (updateData.quantity !== undefined) safeUpdates.quantity = updateData.quantity;
  if (updateData.unit !== undefined) safeUpdates.unit = updateData.unit;
  if (updateData.foodType !== undefined) safeUpdates.foodType = updateData.foodType;
  if (updateData.preparedAt !== undefined) safeUpdates.preparedAt = prep;
  if (updateData.consumeBy !== undefined) safeUpdates.consumeBy = consume;
  if (updateData.pickupDeadline !== undefined) safeUpdates.pickupDeadline = pickup;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.donation.update({
      where: { id },
      data: safeUpdates,
      include: {
        donorOrganization: {
          select: {
            id: true,
            name: true,
            locality: true,
            address: true
          }
        }
      }
    });

    await logAuditEvent({
      actorUserId: user.id,
      donationId: id,
      action: 'DONATION_UPDATED',
      metadata: {
        updatedFields: Object.keys(safeUpdates)
      },
      tx
    });

    return res;
  });

  return updated;
}
