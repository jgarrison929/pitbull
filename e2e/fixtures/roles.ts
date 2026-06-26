/**
 * Maps archive personas (docs/archive/roles-2026-02/) to demo seed accounts.
 * Password: PitbullDemo2026! (see docs/archive/2026-06-plans/DEMO-SEED-ROLES.md)
 */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'PitbullDemo2026!';

export type PersonaKey =
  | 'ceo'
  | 'pm'
  | 'fieldEng'
  | 'estimator'
  | 'arClerk'
  | 'apClerk'
  | 'payrollManager';

export interface Persona {
  key: PersonaKey;
  email: string;
  /** Identity AppRole from RoleSeeder */
  appRole: string;
  /** Granular RBAC template from PermissionConstants.RoleTemplates */
  rbacRole: string;
  archiveDoc: string;
  lifecycles: number[];
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  ceo: {
    key: 'ceo',
    email: 'ceo@demo.local',
    appRole: 'Admin',
    rbacRole: 'Admin',
    archiveDoc: 'CONTROLLER-CFO.md',
    lifecycles: [1, 2],
  },
  pm: {
    key: 'pm',
    email: 'pm@demo.local',
    appRole: 'Supervisor',
    rbacRole: 'ProjectManager',
    archiveDoc: 'PROJECT-MANAGER.md',
    lifecycles: [2, 6, 7, 8, 10],
  },
  fieldEng: {
    key: 'fieldEng',
    email: 'field-eng@demo.local',
    appRole: 'User',
    rbacRole: 'Foreman',
    archiveDoc: 'PROJECT-MANAGER.md',
    lifecycles: [3, 10],
  },
  estimator: {
    key: 'estimator',
    email: 'estimator@demo.local',
    appRole: 'User',
    rbacRole: 'Estimator',
    archiveDoc: 'PROJECT-MANAGER.md',
    lifecycles: [1],
  },
  arClerk: {
    key: 'arClerk',
    email: 'ar-clerk@demo.local',
    appRole: 'User',
    rbacRole: 'Controller',
    archiveDoc: 'AR-CLERK.md',
    lifecycles: [4],
  },
  apClerk: {
    key: 'apClerk',
    email: 'ap-clerk@demo.local',
    appRole: 'User',
    rbacRole: 'Controller',
    archiveDoc: 'AP-CLERK.md',
    lifecycles: [5, 9],
  },
  payrollManager: {
    key: 'payrollManager',
    email: 'mgr-payroll@demo.local',
    appRole: 'Manager',
    rbacRole: 'PayrollSpecialist',
    archiveDoc: 'PAYROLL-MANAGER.md',
    lifecycles: [3],
  },
};

/** Employee + project assignment requirements for workflow success */
export const WORKFLOW_REQUIREMENTS = {
  timeEntryApprove: {
    submitter: 'fieldEng',
    approver: 'pm',
    approverNeeds: ['Employee record linked to AppUser', 'ProjectAssignment Manager/Supervisor on entry project'],
    submitterNeeds: ['Employee record', 'ProjectAssignment on same project'],
  },
  ownerBilling: {
    pmSubmit: 'pm',
    arCertify: 'arClerk',
  },
  subPayApp: {
    pmCreate: 'pm',
    apReview: 'apClerk',
  },
  dailyReport: {
    create: 'fieldEng',
    submitApproveLock: 'pm',
  },
} as const;

export const LIFECYCLE_NAMES: Record<number, string> = {
  1: 'Bid → Project',
  2: 'Project setup',
  3: 'Crew time → payroll',
  4: 'Owner pay app (AR)',
  5: 'Subcontract pay app (AP)',
  6: 'Change order',
  7: 'RFI',
  8: 'Submittal',
  9: 'Vendor invoice',
  10: 'Daily report',
};