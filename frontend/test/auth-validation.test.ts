import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  registerFormSchema,
  loginFormSchema,
  forgotPasswordFormSchema,
  resetPasswordFormSchema,
  resendVerificationFormSchema,
} from '../src/utils/auth-validation.ts';
import { normalizeApiError, ApiClientError } from '../src/services/api.ts';

test('Registration Validation: Accepts valid seeker registration data', () => {
  const result = registerFormSchema.safeParse({
    fullName: 'Jane Doe',
    email: 'jane.doe@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'seeker',
    acceptTerms: true,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, 'jane.doe@example.com');
    assert.equal(result.data.role, 'seeker');
  }
});

test('Registration Validation: Prohibits admin role registration', () => {
  const result = registerFormSchema.safeParse({
    fullName: 'Admin User',
    email: 'admin@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'admin',
    acceptTerms: true,
  });

  assert.equal(result.success, false);
});

test('Registration Validation: Rejects mismatched passwords', () => {
  const result = registerFormSchema.safeParse({
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    password: 'Password123!',
    confirmPassword: 'DifferentPassword456!',
    role: 'seeker',
    acceptTerms: true,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const confirmError = result.error.issues.find((i) => i.path.includes('confirmPassword'));
    assert.ok(confirmError, 'Must contain confirmPassword mismatch error');
    assert.equal(confirmError.message, 'Passwords do not match');
  }
});

test('Registration Validation: Rejects passwords shorter than 8 characters', () => {
  const result = registerFormSchema.safeParse({
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    password: 'short',
    confirmPassword: 'short',
    role: 'seeker',
    acceptTerms: true,
  });

  assert.equal(result.success, false);
});

test('Registration Validation: Rejects unaccepted terms and conditions', () => {
  const result = registerFormSchema.safeParse({
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'employer',
    acceptTerms: false,
  });

  assert.equal(result.success, false);
});

test('Login Validation: Accepts valid email and password credentials', () => {
  const result = loginFormSchema.safeParse({
    email: 'user@example.com',
    password: 'SecurePassword123',
  });

  assert.equal(result.success, true);
});

test('Login Validation: Rejects invalid email format', () => {
  const result = loginFormSchema.safeParse({
    email: 'not-an-email',
    password: 'Password123',
  });

  assert.equal(result.success, false);
});

test('Login Validation: Rejects empty password', () => {
  const result = loginFormSchema.safeParse({
    email: 'user@example.com',
    password: '',
  });

  assert.equal(result.success, false);
});

test('Forgot Password Validation: Accepts valid email and rejects invalid format', () => {
  const valid = forgotPasswordFormSchema.safeParse({ email: 'recover@example.com' });
  assert.equal(valid.success, true);

  const invalid = forgotPasswordFormSchema.safeParse({ email: 'bad-email' });
  assert.equal(invalid.success, false);
});

test('Reset Password Validation: Requires exact 64-character hex token and matching password', () => {
  const validToken = 'a'.repeat(64);
  const result = resetPasswordFormSchema.safeParse({
    token: validToken,
    newPassword: 'BrandNewPassword123',
    confirmPassword: 'BrandNewPassword123',
  });

  assert.equal(result.success, true);

  const invalidTokenResult = resetPasswordFormSchema.safeParse({
    token: 'too-short',
    newPassword: 'BrandNewPassword123',
    confirmPassword: 'BrandNewPassword123',
  });
  assert.equal(invalidTokenResult.success, false);
});

test('Resend Verification Validation: Validates email format strictly', () => {
  const valid = resendVerificationFormSchema.safeParse({ email: 'verify@example.com' });
  assert.equal(valid.success, true);

  const invalid = resendVerificationFormSchema.safeParse({ email: '' });
  assert.equal(invalid.success, false);
});

test('API Error Normalization: Normalizes structured backend error responses', () => {
  const mockAxiosError = {
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        success: false,
        message: 'Email already in use',
        code: 'EMAIL_IN_USE',
        errors: [{ field: 'email', message: 'Already exists' }],
      },
    },
  };

  const normalized = normalizeApiError(mockAxiosError);
  assert.ok(normalized instanceof ApiClientError);
  assert.equal(normalized.statusCode, 409);
  assert.equal(normalized.message, 'Email already in use');
  assert.equal(normalized.code, 'EMAIL_IN_USE');
  assert.deepEqual(normalized.errors, [{ field: 'email', message: 'Already exists' }]);
});

test('API Error Normalization: Normalizes network connection failure safely', () => {
  const mockNetworkError = {
    isAxiosError: true,
    response: undefined,
    message: 'Network Error',
  };

  const normalized = normalizeApiError(mockNetworkError);
  assert.ok(normalized instanceof ApiClientError);
  assert.equal(normalized.statusCode, 0);
  assert.equal(normalized.code, 'NETWORK_ERROR');
  assert.ok(normalized.message.includes('Unable to connect to the server'));
});
