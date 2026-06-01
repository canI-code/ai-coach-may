// Feature: candidate-dashboard-suite, Property 28: Invalid profile updates are rejected atomically
// Feature: candidate-dashboard-suite, Property 29: Valid profile updates round-trip
// Feature: candidate-dashboard-suite, Property 30: Persona read normalizes to the default
// Feature: candidate-dashboard-suite, Property 31: Writes are confined to the user record

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateProfileUpdate, normalizePersona, buildProfileSetUpdate } from '../profile-validation';

describe('Dashboard Suite: Profile Validation', () => {
  const allowedPersonas = ['tech_lead', 'general_recruiter', 'stress_interviewer'];
  const approvedInstitutionCodes = ['MIT', 'STANFORD', 'BERKELEY'];
  const ctx = { allowedPersonas, approvedInstitutionCodes };

  it('Property 28: Invalid profile updates are rejected atomically', () => {
    // Generate an invalid update by forcing at least one error
    fc.assert(
      fc.property(
        fc.record({
          name: fc.constant('   '), // Invalid name
          email: fc.string(),       // Likely invalid email
          persona: fc.string().filter(p => !allowedPersonas.includes(p)), // Invalid persona
          difficulty: fc.integer({ min: 6, max: 10 }), // Invalid difficulty
          institutionCode: fc.string().filter(c => !approvedInstitutionCodes.includes(c) && c !== ''), // Invalid code
        }),
        (invalidUpdate) => {
          const result = validateProfileUpdate(invalidUpdate, ctx);
          expect(result.valid).toBe(false);
          expect(Object.keys(result.validatedFields)).toHaveLength(0); // Atomically rejected, nothing persisted
          expect(Object.keys(result.errors).length).toBeGreaterThan(0);
          
          const setUpdate = buildProfileSetUpdate(result.validatedFields);
          expect(Object.keys(setUpdate)).toHaveLength(0);
        }
      )
    );
  });

  it('Property 29 & 31: Valid profile updates round-trip and confine writes', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1 }).map(s => s.replace(/^\s+|\s+$/g, '')).filter(s => s.length > 0),
          email: fc.constant('test@example.com'), // simple valid email
          persona: fc.constantFrom(...allowedPersonas),
          difficulty: fc.integer({ min: 1, max: 5 }),
          institutionCode: fc.constantFrom(...approvedInstitutionCodes, '', null),
          emailNotifications: fc.boolean()
        }),
        (validUpdate) => {
          const result = validateProfileUpdate(validUpdate, ctx);
          expect(result.valid).toBe(true);
          expect(Object.keys(result.errors)).toHaveLength(0);
          
          const setUpdate = buildProfileSetUpdate(result.validatedFields);
          
          // Property 31: Writes are confined to allowed fields
          const allowedKeys = ['fullName', 'email', 'config.aiPersona', 'config.difficulty', 'session.institutionCode', 'emailNotifications'];
          for (const key of Object.keys(setUpdate)) {
            expect(allowedKeys).toContain(key);
          }
          
          // Property 29: Round-trip (mapped correctly)
          expect(setUpdate.fullName).toBe(validUpdate.name);
          expect(setUpdate.email).toBe(validUpdate.email);
          expect(setUpdate['config.aiPersona']).toBe(validUpdate.persona);
          expect(setUpdate['config.difficulty']).toBe(validUpdate.difficulty);
          if (validUpdate.institutionCode === null) {
            expect(setUpdate['session.institutionCode']).toBe('');
          } else {
            expect(setUpdate['session.institutionCode']).toBe(validUpdate.institutionCode);
          }
          expect(setUpdate.emailNotifications).toBe(validUpdate.emailNotifications);
        }
      )
    );
  });

  it('Property 30: Persona read normalizes to the default', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: null }),
        (stored) => {
          const normalized = normalizePersona(stored, allowedPersonas);
          
          if (stored && allowedPersonas.includes(stored)) {
            expect(normalized).toBe(stored);
          } else {
            expect(normalized).toBe('general_recruiter');
          }
        }
      )
    );
  });
});