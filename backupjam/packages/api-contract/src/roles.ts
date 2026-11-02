export const USER_CAPABILITIES = [
  'musician', 'band_member', 'band_manager', 'venue_owner', 'venue_staff', 'organizer', 'booking_agent',
  'artist_manager', 'sound_engineer', 'lighting_technician', 'music_teacher', 'enthusiast', 'customer',
] as const;
export type UserCapability = (typeof USER_CAPABILITIES)[number];

export const ORGANIZATION_TYPES = ['band', 'venue', 'agency', 'organizer', 'company'] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORG_ROLES = ['owner', 'admin', 'manager', 'member', 'staff'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_PERMISSIONS = [
  'org.profile.edit', 'org.members.manage', 'org.roles.assign_admin', 'org.jobs.manage', 'org.offers.negotiate',
  'org.bookings.manage', 'org.calendar.manage', 'org.events.manage', 'org.messages.respond', 'org.finance.view',
  'org.payouts.manage', 'org.reviews.respond', 'org.delete',
] as const;
export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

/** Mirrors docs/00-decisions.md. Explicit lists (no inheritance) so every grant is reviewable. */
export const ORG_ROLE_PERMISSIONS: Readonly<Record<OrgRole, readonly OrgPermission[]>> = {
  owner: [...ORG_PERMISSIONS],
  admin: ['org.profile.edit', 'org.members.manage', 'org.jobs.manage', 'org.offers.negotiate', 'org.bookings.manage', 'org.calendar.manage', 'org.events.manage', 'org.messages.respond', 'org.finance.view', 'org.reviews.respond'],
  manager: ['org.profile.edit', 'org.jobs.manage', 'org.offers.negotiate', 'org.bookings.manage', 'org.calendar.manage', 'org.events.manage', 'org.messages.respond', 'org.reviews.respond'],
  member: ['org.calendar.manage', 'org.messages.respond'],
  staff: ['org.jobs.manage', 'org.calendar.manage', 'org.events.manage', 'org.messages.respond'],
};

export function orgRoleHas(role: OrgRole, permission: OrgPermission): boolean {
  return ORG_ROLE_PERMISSIONS[role].includes(permission);
}

export const STAFF_ROLES = ['super_admin', 'trust_safety', 'finance_ops', 'support', 'localization_manager', 'analyst'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_PERMISSIONS = [
  'admin.users.read', 'admin.users.suspend', 'admin.verification.review', 'admin.moderation.act', 'admin.finance.read',
  'admin.finance.refund', 'admin.i18n.manage', 'admin.flags.manage', 'admin.staff.manage', 'admin.audit.read', 'admin.countries.manage',
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const STAFF_ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly StaffPermission[]>> = {
  super_admin: [...STAFF_PERMISSIONS],
  trust_safety: ['admin.users.read', 'admin.users.suspend', 'admin.verification.review', 'admin.moderation.act', 'admin.audit.read'],
  finance_ops: ['admin.users.read', 'admin.finance.read', 'admin.finance.refund', 'admin.audit.read'],
  support: ['admin.users.read'],
  localization_manager: ['admin.i18n.manage', 'admin.users.read'],
  analyst: ['admin.users.read', 'admin.finance.read'],
};

export function staffRoleHas(role: StaffRole, permission: StaffPermission): boolean {
  return STAFF_ROLE_PERMISSIONS[role].includes(permission);
}

export const VERIFICATION_BADGES = ['identity_verified', 'official_band', 'official_artist', 'verified_venue', 'verified_organizer'] as const;
export type VerificationBadge = (typeof VERIFICATION_BADGES)[number];
