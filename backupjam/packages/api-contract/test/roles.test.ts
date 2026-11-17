import { describe, expect, it } from 'vitest';
import { ORG_ROLE_PERMISSIONS, ORG_PERMISSIONS, STAFF_ROLE_PERMISSIONS, STAFF_PERMISSIONS, orgRoleHas } from '../src';

describe('permission matrix', () => {
  it('only owners can delete orgs, manage payouts or assign admins', () => {
    for (const p of ['org.delete', 'org.payouts.manage', 'org.roles.assign_admin'] as const) {
      const holders = Object.entries(ORG_ROLE_PERMISSIONS).filter(([, ps]) => ps.includes(p)).map(([r]) => r);
      expect(holders).toEqual(['owner']);
    }
  });
  it('owner has every org permission and super_admin every staff permission', () => {
    expect([...ORG_ROLE_PERMISSIONS.owner].sort()).toEqual([...ORG_PERMISSIONS].sort());
    expect([...STAFF_ROLE_PERMISSIONS.super_admin].sort()).toEqual([...STAFF_PERMISSIONS].sort());
  });
  it('members cannot negotiate offers or see finance', () => {
    expect(orgRoleHas('member', 'org.offers.negotiate')).toBe(false);
    expect(orgRoleHas('member', 'org.finance.view')).toBe(false);
  });
  it('lists contain no duplicates or unknown permissions', () => {
    for (const ps of Object.values(ORG_ROLE_PERMISSIONS)) {
      expect(new Set(ps).size).toBe(ps.length);
      ps.forEach((p) => expect(ORG_PERMISSIONS).toContain(p));
    }
  });
});
