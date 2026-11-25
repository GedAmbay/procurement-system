export const MIN_PASSWORD_LENGTH = 10;

const COMMON_PASSWORDS = new Set([
  "password123",
  "password1234",
  "1234567890",
  "123456789012",
  "qwerty1234",
  "qwertyuiop",
  "admin12345",
  "admin@1234",
  "pandan1234",
  "procurement",
  "municipality",
  "letmein123",
  "welcome123",
  "changeme123",
  "bac1234567",
]);

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    };
  }

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return {
      valid: false,
      error: "This password is too common. Please choose a stronger password.",
    };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasLower || !hasUpper || !hasNumberOrSymbol) {
    return {
      valid: false,
      error: "Password must include uppercase, lowercase, and at least one number or symbol.",
    };
  }

  return { valid: true };
}
