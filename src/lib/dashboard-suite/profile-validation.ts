// Feature: candidate-dashboard-suite
// Profile validation and write shaping (pure)

import type { ProfileUpdate, ValidationResult } from './types';
import { DIFFICULTY_BOUNDS } from './constants';

export interface ValidationContext {
  allowedPersonas: string[];
  approvedInstitutionCodes: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProfileUpdate(
  update: ProfileUpdate,
  ctx: ValidationContext
): ValidationResult {
  const errors: Record<string, string> = {};
  const validatedFields: Partial<ProfileUpdate> = {};

  if (update.name !== undefined) {
    const trimmed = update.name.trim();
    if (trimmed.length === 0) {
      errors.name = 'Name cannot be empty';
    } else {
      validatedFields.name = trimmed;
    }
  }

  if (update.email !== undefined) {
    const trimmed = update.email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      errors.email = 'Invalid email syntax';
    } else {
      validatedFields.email = trimmed;
    }
  }

  if (update.persona !== undefined) {
    if (!ctx.allowedPersonas.includes(update.persona)) {
      errors.persona = 'Invalid persona selection';
    } else {
      validatedFields.persona = update.persona;
    }
  }

  if (update.difficulty !== undefined) {
    if (update.difficulty < DIFFICULTY_BOUNDS.min || update.difficulty > DIFFICULTY_BOUNDS.max) {
      errors.difficulty = 'Invalid difficulty level';
    } else {
      validatedFields.difficulty = update.difficulty;
    }
  }

  if (update.institutionCode !== undefined) {
    if (update.institutionCode !== null && update.institutionCode !== '' && !ctx.approvedInstitutionCodes.includes(update.institutionCode)) {
      errors.institutionCode = 'Invalid institution code';
    } else {
      // allow clearing with null or empty string, store as string
      validatedFields.institutionCode = update.institutionCode === null ? '' : update.institutionCode;
    }
  }

  if (update.emailNotifications !== undefined) {
    validatedFields.emailNotifications = !!update.emailNotifications;
  }

  const valid = Object.keys(errors).length === 0;

  // reject persists nothing
  return {
    valid,
    errors,
    validatedFields: valid ? validatedFields : {},
  };
}

export function normalizePersona(stored: string | null | undefined, allowedPersonas: string[]): string {
  if (!stored || !allowedPersonas.includes(stored)) {
    return 'general_recruiter';
  }
  return stored;
}

export function buildProfileSetUpdate(validatedFields: Partial<ProfileUpdate>): Record<string, any> {
  const setUpdate: Record<string, any> = {};

  if (Object.keys(validatedFields).length === 0) {
    return setUpdate;
  }

  if (validatedFields.name !== undefined) setUpdate.fullName = validatedFields.name;
  if (validatedFields.email !== undefined) setUpdate.email = validatedFields.email;
  if (validatedFields.persona !== undefined) setUpdate['config.aiPersona'] = validatedFields.persona;
  if (validatedFields.difficulty !== undefined) setUpdate['config.difficulty'] = validatedFields.difficulty;
  if (validatedFields.institutionCode !== undefined) setUpdate['session.institutionCode'] = validatedFields.institutionCode;
  if (validatedFields.emailNotifications !== undefined) setUpdate.emailNotifications = validatedFields.emailNotifications;

  return setUpdate;
}