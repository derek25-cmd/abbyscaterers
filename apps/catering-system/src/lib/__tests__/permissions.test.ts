import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, STAFF_ROLES, hasPermission, isStaffRole, type Permission, type StaffRole } from '../permissions';

// One row per role, mirroring the access matrix agreed for Phase 1 and the SQL
// helpers in 20261014000000_hr_ops_roles.sql / 20261014000200_hr_ops_rls.sql.
// If a row here changes, the matching helper or policy must change too.
const MATRIX: Record<StaffRole, Record<Permission, boolean>> = {
  admin: {
    'hr.manage': true, 'ops.manage': true, 'settings.manage': true, 'payroll.manage': true,
    'employees.viewFull': true, 'audit.view': true, 'audit.viewAll': true,
  },
  general_manager: {
    'hr.manage': true, 'ops.manage': true, 'settings.manage': false, 'payroll.manage': true,
    'employees.viewFull': true, 'audit.view': true, 'audit.viewAll': true,
  },
  hr_manager: {
    'hr.manage': true, 'ops.manage': true, 'settings.manage': false, 'payroll.manage': true,
    'employees.viewFull': true, 'audit.view': true, 'audit.viewAll': false,
  },
  finance: {
    'hr.manage': false, 'ops.manage': true, 'settings.manage': false, 'payroll.manage': true,
    'employees.viewFull': true, 'audit.view': false, 'audit.viewAll': false,
  },
  staff: {
    'hr.manage': false, 'ops.manage': true, 'settings.manage': false, 'payroll.manage': false,
    'employees.viewFull': false, 'audit.view': false, 'audit.viewAll': false,
  },
};

describe('permissions', () => {
  it('covers every role', () => {
    expect([...STAFF_ROLES].sort()).toEqual(Object.keys(MATRIX).sort());
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(Object.keys(MATRIX).sort());
  });

  for (const role of STAFF_ROLES) {
    describe(role, () => {
      for (const [permission, expected] of Object.entries(MATRIX[role]) as [Permission, boolean][]) {
        it(`${expected ? 'has' : 'lacks'} ${permission}`, () => {
          expect(hasPermission(role, permission)).toBe(expected);
        });
      }

      it('has no permission outside the matrix', () => {
        const granted = ROLE_PERMISSIONS[role].slice().sort();
        const expected = (Object.entries(MATRIX[role]) as [Permission, boolean][]).filter(([, v]) => v).map(([k]) => k).sort();
        expect(granted).toEqual(expected);
      });
    });
  }

  it('grants nothing to a missing role', () => {
    expect(hasPermission(null, 'ops.manage')).toBe(false);
    expect(hasPermission(undefined, 'hr.manage')).toBe(false);
  });

  it('recognises only known roles', () => {
    expect(isStaffRole('hr_manager')).toBe(true);
    expect(isStaffRole('superuser')).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });

  it('only admin manages settings, and HR rights are admin + hr_manager + general_manager', () => {
    expect(STAFF_ROLES.filter((r) => hasPermission(r, 'settings.manage'))).toEqual(['admin']);
    expect(STAFF_ROLES.filter((r) => hasPermission(r, 'hr.manage')).sort()).toEqual(['admin', 'general_manager', 'hr_manager']);
  });
});
