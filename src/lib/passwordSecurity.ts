import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface PasswordRulesStatus {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

/**
 * Evaluates password against strict complexity requirements:
 * 1. Minimum 8 characters (NOT 6)
 * 2. At least 1 uppercase letter (A-Z)
 * 3. At least 1 lowercase letter (a-z)
 * 4. At least 1 digit (0-9)
 * 5. At least 1 special character (!@#$%^&*...)
 */
export function evaluatePasswordRules(password: string): PasswordRulesStatus {
  const pwd = password || '';
  const minLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const isValid = minLength && hasUpper && hasLower && hasNumber && hasSpecial;

  return {
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isValid,
  };
}

/**
 * Returns a human-friendly error string if password fails any criteria or doesn't match confirm password.
 */
export function getPasswordValidationError(password: string, confirmPassword?: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  const rules = evaluatePasswordRules(password);
  if (!rules.minLength) {
    return 'Password must be at least 8 characters long.';
  }
  if (!rules.hasUpper) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!rules.hasLower) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!rules.hasNumber) {
    return 'Password must contain at least one number (0-9).';
  }
  if (!rules.hasSpecial) {
    return 'Password must contain at least one special character (!@#$%^&*...).';
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}

/**
 * Cryptographic one-way salted SHA-256 hash used to prevent password duplication across all users
 * without ever exposing or storing raw passwords in Firestore.
 */
export async function hashPasswordForUniqueness(password: string): Promise<string> {
  const pepper = 'viitsa_global_pwd_registry_v1_pepper';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${pepper}:${password.normalize('NFC')}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if the password has already been registered by ANY user in the system.
 * Rejects duplicate passwords across patients, doctors, clinic staff, and administrators.
 */
export async function assertPasswordUniqueness(
  password: string,
  currentUserId?: string
): Promise<{ ok: boolean; error?: string; hash: string }> {
  try {
    const hash = await hashPasswordForUniqueness(password);
    const docRef = doc(db, 'password_registry', hash);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      // If claimed by another user, reject
      if (!currentUserId || (data.user_id && data.user_id !== currentUserId)) {
        return {
          ok: false,
          error: 'This password is already in use by another account. For security, every user must have a unique password. Please choose a different password.',
          hash,
        };
      }
    }

    return { ok: true, hash };
  } catch (err) {
    console.warn('Password uniqueness check warning:', err);
    const hash = await hashPasswordForUniqueness(password);
    return { ok: true, hash };
  }
}

/**
 * Registers a password hash to the global uniqueness registry.
 */
export async function claimPasswordHash(
  passwordOrHash: string,
  userId: string,
  email?: string
): Promise<void> {
  try {
    const hash = passwordOrHash.length === 64 && /^[0-9a-f]+$/i.test(passwordOrHash)
      ? passwordOrHash
      : await hashPasswordForUniqueness(passwordOrHash);

    const docRef = doc(db, 'password_registry', hash);
    await setDoc(docRef, {
      hash,
      user_id: userId,
      email: email ? email.trim().toLowerCase() : null,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Claim password hash warning:', err);
  }
}
