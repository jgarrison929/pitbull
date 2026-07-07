/**
 * Maps signup wizard state to the JSON body POSTed to /api/auth/register.
 * Field rules mirror RegisterRequestValidator on the API.
 */

export interface OwnerWizardState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
  industryType?: string;
  employeeRange?: string;
}

export interface OwnerRegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName?: string;
  industryType?: string;
  employeeRange?: string;
}

/** Matches RegisterRequestValidator name rules. */
export const OWNER_NAME_PATTERN = /^[a-zA-Z\s\-']+$/;

function trimName(value: string): string {
  return value.trim();
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Build the register POST body from wizard state.
 * Trims whitespace; company names may contain digits (validator allows any chars).
 */
export function buildOwnerRegisterPayload(
  state: OwnerWizardState
): OwnerRegisterPayload {
  const firstName = trimName(state.firstName);
  const lastName = trimName(state.lastName);
  const email = state.email.trim();
  const companyName = state.companyName.trim();

  const payload: OwnerRegisterPayload = {
    firstName,
    lastName,
    email,
    password: state.password,
  };

  if (companyName) payload.companyName = companyName;

  const industryType = trimOptional(state.industryType);
  if (industryType) payload.industryType = industryType;

  const employeeRange = trimOptional(state.employeeRange);
  if (employeeRange) payload.employeeRange = employeeRange;

  return payload;
}

export function isValidOwnerName(name: string): boolean {
  const trimmed = trimName(name);
  return trimmed.length > 0 && OWNER_NAME_PATTERN.test(trimmed);
}