import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.model.js';
import { User, type UserRole } from '../models/user.model.js';
import { registerSchema } from '../validators/auth.validator.js';

export const DEFAULT_ADMIN_NAME = 'Platform Administrator';
const ADMIN_ROLE = 'admin' as const satisfies UserRole;

export const adminBootstrapSchema = registerSchema
  .pick({
    fullName: true,
    email: true,
    password: true,
  })
  .strict();

export interface BootstrapAdminInput {
  name?: string;
  email: string;
  password: string;
}

export interface SafeBootstrappedAdmin {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
}

export type BootstrapAdminResult =
  | {
      ok: true;
      user: SafeBootstrappedAdmin;
      message: string;
    }
  | {
      ok: false;
      code:
        | 'ADMIN_ALREADY_EXISTS'
        | 'EMAIL_ALREADY_EXISTS'
        | 'VALIDATION_ERROR'
        | 'PASSWORD_HASH_VERIFICATION_FAILED'
        | 'BOOTSTRAP_FAILED';
      message: string;
      errors?: Array<{ field: string; message: string }>;
    };

export interface BootstrapDependencies {
  hasExistingAdmin?: () => Promise<boolean>;
  hasExistingEmail?: (email: string) => Promise<boolean>;
  createAdminUser?: (payload: {
    name: string;
    email: string;
    password: string;
    role: 'admin';
    isActive: true;
    isEmailVerified: true;
    isDeleted: false;
  }) => Promise<{
    _id: unknown;
    id?: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    isEmailVerified: boolean;
    password?: string;
  }>;
  verifyStoredPasswordHash?: (userId: string) => Promise<string | undefined>;
  writeAuditLog?: (entry: {
    actor: mongoose.Types.ObjectId;
    actorRole: 'system';
    action: string;
    resource: string;
    resourceId: mongoose.Types.ObjectId;
    changes: Record<string, unknown>;
    statusCode: number;
  }) => Promise<void>;
}

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

export async function checkAdminExists(): Promise<boolean> {
  const existing = await User.exists({ role: ADMIN_ROLE, isDeleted: false });
  return Boolean(existing);
}

export async function bootstrapFirstAdmin(
  input: BootstrapAdminInput,
  deps: BootstrapDependencies = {}
): Promise<BootstrapAdminResult> {
  const hasExistingAdmin = deps.hasExistingAdmin ?? checkAdminExists;
  if (await hasExistingAdmin()) {
    return {
      ok: false,
      code: 'ADMIN_ALREADY_EXISTS',
      message:
        'Refused: An Admin account already exists. Creating additional Admin accounts via bootstrap is disabled by security policy.',
    };
  }

  const candidateName =
    input.name && input.name.trim().length > 0 ? input.name : DEFAULT_ADMIN_NAME;

  const parsed = adminBootstrapSchema.safeParse({
    fullName: candidateName,
    email: input.email,
    password: input.password,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Admin credentials did not pass project validation rules.',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path[0] ? String(issue.path[0]) : 'input',
        message: issue.message,
      })),
    };
  }

  const { fullName, email, password } = parsed.data;

  const hasExistingEmail =
    deps.hasExistingEmail ?? (async (normalizedEmail: string) => Boolean(await User.exists({ email: normalizedEmail })));

  if (await hasExistingEmail(email)) {
    return {
      ok: false,
      code: 'EMAIL_ALREADY_EXISTS',
      message:
        'Refused: An account with that email already exists. Existing user accounts will not be modified.',
    };
  }

  const createAdminUser =
    deps.createAdminUser ??
    (async (payload) => User.create(payload));

  const created = await createAdminUser({
    name: fullName,
    email,
    password,
    role: ADMIN_ROLE,
    isActive: true,
    isEmailVerified: true,
    isDeleted: false,
  });

  const userId = created.id ?? String(created._id);

  const verifyStoredPasswordHash =
    deps.verifyStoredPasswordHash ??
    (async (id: string) => {
      const stored = await User.findById(id).select('+password').lean();
      return stored?.password;
    });

  const storedHash = (await verifyStoredPasswordHash(userId)) ?? created.password;
  if (!storedHash || storedHash === password || !BCRYPT_HASH_PATTERN.test(storedHash)) {
    return {
      ok: false,
      code: 'PASSWORD_HASH_VERIFICATION_FAILED',
      message: 'Security verification failed: stored Admin password was not properly hashed.',
    };
  }

  const writeAuditLog =
    deps.writeAuditLog ??
    (async (entry) => {
      await AuditLog.create(entry);
    });

  try {
    if (mongoose.isValidObjectId(userId)) {
      const objectId = new mongoose.Types.ObjectId(userId);
      await writeAuditLog({
        actor: objectId,
        actorRole: 'system',
        action: 'SYSTEM_FIRST_ADMIN_BOOTSTRAPPED',
        resource: 'User',
        resourceId: objectId,
        changes: {
          email: created.email,
          role: ADMIN_ROLE,
          isEmailVerified: true,
        },
        statusCode: 201,
      });
    }
  } catch {
    // Non-fatal: admin bootstrap succeeded even if audit persistence encountered a transient issue
  }

  return {
    ok: true,
    user: {
      _id: userId,
      name: created.name,
      email: created.email,
      role: created.role,
      isActive: created.isActive,
      isEmailVerified: created.isEmailVerified,
    },
    message: 'First Admin account created securely.',
  };
}
