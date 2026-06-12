/**
 * B2B Utility functions — slugification, password & invite code generation.
 */

/**
 * Convert a college name to a database-safe slug.
 * "IIT Delhi" → "iit_delhi"
 * "St. Xavier's College, Mumbai" → "st_xaviers_college_mumbai"
 */
export function slugifyCollegeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')        // remove apostrophes
    .replace(/[^a-z0-9]+/g, '_') // replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '')     // trim leading/trailing underscores
    .substring(0, 60);           // limit length
}

/**
 * Generate a database name for an institute.
 * Prefixed with "aicoach_inst_" for easy identification.
 */
export function generateDbName(collegeName: string): string {
  const slug = slugifyCollegeName(collegeName);
  return `aicoach_inst_${slug}`;
}

/**
 * Generate a random 12-character password for auto-generated credentials.
 * Includes uppercase, lowercase, digits, and special characters.
 */
export function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  // Ensure at least one of each type
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining 8 characters
  for (let i = 0; i < 8; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Generate an 8-character alphanumeric invite code.
 * Uses uppercase letters and digits for readability.
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes I, O, 0, 1 for clarity
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
