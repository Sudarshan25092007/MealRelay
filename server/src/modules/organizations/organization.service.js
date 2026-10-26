import prisma from '../../config/prisma.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';

export async function getOrganizationById(id) {
  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      approvalStatus: true,
      address: true,
      locality: true,
      createdAt: true
    }
  });

  if (!org) {
    throw new NotFoundError('Organization not found');
  }

  return org;
}

export async function updateOrganizationApproval(id, { approvalStatus }, adminUser) {
  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(approvalStatus)) {
    throw new BadRequestError('Invalid approval status');
  }

  const existing = await prisma.organization.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Organization not found');
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: { approvalStatus }
  });

  await logAuditEvent({
    actorUserId: adminUser.id,
    action: `ORGANIZATION_${approvalStatus}`,
    metadata: {
      organizationId: id,
      previousStatus: existing.approvalStatus,
      newStatus: approvalStatus
    }
  });

  return updated;
}
