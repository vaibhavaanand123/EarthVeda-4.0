import crypto from 'node:crypto';
import { generateSecret, encryptSecret, decryptSecret, verifyTotp } from '../lib/mfa.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { hashPassword, randomToken, sha256, verifyPassword } from '../lib/security.js';
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/** Admin users, password login and server-side sessions (revocable). */
export function createAuthService({ adminRepository, config, logger, now = () => new Date() }) {
  const iso = (d = now()) => d.toISOString();
  const later = (ms) => new Date(now().getTime() + ms).toISOString();
  const publicUser = (u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    mfaEnabled: Boolean(u.mfaEnabled),
    mfaRequired: config.requireAdminMfa && !u.mfaEnabled,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  });
  return {
    SESSION_HOURS,
    /** Create the first owner from ADMIN_EMAIL / ADMIN_PASSWORD when there is none. */
    async bootstrap({ email, password }) {
      if ((await adminRepository.countUsers()) > 0 || !email || !password) return false;
      if (password.length < 12) {
        logger.warn('ADMIN_PASSWORD must be at least 12 characters; first admin not created');
        return false;
      }
      await this.createUser(
        {
          email: email.toLowerCase(),
          name: 'Owner',
          role: 'owner',
          password,
        },
        'bootstrap',
      );
      logger.info('first admin user created', {
        email,
      });
      return true;
    },
    async createUser({ email, name, role, password }, actor) {
      if (await adminRepository.findUserByEmail(email))
        throw conflict('email_taken', 'This email already has an account.');
      const id = crypto.randomUUID();
      await adminRepository.insertUser({
        id,
        email,
        name,
        role,
        passwordHash: await hashPassword(password),
        now: iso(),
      });
      await adminRepository.audit({
        actor: actor?.email || String(actor),
        action: 'user.create',
        entity: 'user',
        entityId: id,
        data: {
          email,
          role,
        },
        now: iso(),
      });
      return publicUser(await adminRepository.findUserById(id));
    },
    async updateUser(id, { name, role, active }, actor) {
      const user = await adminRepository.findUserById(id);
      if (!user) throw notFound('User not found.');
      if (actor.id === id && (!active || role !== 'owner') && user.role === 'owner')
        throw badRequest('self_lockout', 'You cannot demote or deactivate yourself.');
      await adminRepository.updateUser({
        id,
        name,
        role,
        active,
      });
      if (!active) await adminRepository.deleteUserSessions(id);
      await adminRepository.audit({
        actor: actor.email,
        action: 'user.update',
        entity: 'user',
        entityId: id,
        data: {
          role,
          active,
        },
        now: iso(),
      });
      return publicUser(await adminRepository.findUserById(id));
    },
    async resetPassword(id, password, actor) {
      const user = await adminRepository.findUserById(id);
      if (!user) throw notFound('User not found.');
      await adminRepository.setPassword(id, await hashPassword(password));
      await adminRepository.deleteUserSessions(id);
      await adminRepository.audit({
        actor: actor.email,
        action: 'user.password_reset',
        entity: 'user',
        entityId: id,
        now: iso(),
      });
    },
    async changeOwnPassword(user, { currentPassword, newPassword }) {
      const fresh = await adminRepository.findUserById(user.id);
      if (!(await verifyPassword(currentPassword, fresh.passwordHash)))
        throw badRequest('wrong_password', 'Your current password is not correct.');
      await adminRepository.setPassword(user.id, await hashPassword(newPassword));
      await adminRepository.deleteUserSessions(user.id);
    },
    listUsers: async () => (await adminRepository.listUsers()).map(publicUser),
    async beginMfa(user, password) {
      const fresh = await adminRepository.findUserById(user.id);
      if (fresh.mfaEnabled) throw conflict('mfa_enabled', 'MFA is already enabled.');
      if (!(await verifyPassword(password, fresh.passwordHash)))
        throw unauthorized('Current password is not correct.');
      const secret = generateSecret();
      await adminRepository.setMfaPending(user.id, {
        secret: encryptSecret(secret, config.appSecret),
        expiresAt: later(10 * 60000),
      });
      return {
        secret,
        uri: `otpauth://totp/Earthveda:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Earthveda&algorithm=SHA1&digits=6&period=30`,
      };
    },
    async confirmMfa(user, otp) {
      const fresh = await adminRepository.findUserById(user.id);
      if (!fresh.mfaPending || fresh.mfaPending.expiresAt < iso())
        throw badRequest('mfa_expired', 'Start MFA setup again.');
      const counter = verifyTotp(
        decryptSecret(fresh.mfaPending.secret, config.appSecret),
        otp,
        now().getTime(),
      );
      if (counter === null) throw badRequest('wrong_code', 'Authenticator code is not correct.');
      await adminRepository.enableMfa(user.id, fresh.mfaPending.secret, counter);
      await adminRepository.deleteUserSessions(user.id);
      await adminRepository.audit({
        actor: user.email,
        action: 'auth.mfa.enabled',
        entity: 'user',
        entityId: user.id,
        now: iso(),
      });
    },
    async login({ email, password, userAgent, otp }) {
      const user = await adminRepository.findUserByEmail(email);
      const locked = user?.lockedUntil && user.lockedUntil > iso();
      let valid = await verifyPassword(password, user?.passwordHash);
      if (valid && user?.mfaEnabled) {
        const counter = verifyTotp(
          decryptSecret(user.mfaSecret, config.appSecret),
          otp,
          now().getTime(),
        );
        valid = counter !== null && (await adminRepository.consumeMfa(user.id, counter));
      } // always run: constant timing
      if (!user || !user.active || locked || !valid) {
        if (user && !locked && !valid) {
          const fails = user.failedAttempts + 1;
          await adminRepository.loginFailed(
            user.id,
            fails >= MAX_FAILED ? later(LOCK_MINUTES * 60_000) : null,
          );
        }
        logger.warn('admin login failed', {
          email,
          locked: Boolean(locked),
        });
        throw unauthorized(
          locked
            ? 'Too many attempts. Try again in 15 minutes.'
            : 'Email, password or authenticator code is not correct.',
        );
      }
      await adminRepository.loginSucceeded(user.id, iso());
      const token = randomToken(32);
      await adminRepository.insertSession({
        idHash: sha256(token),
        userId: user.id,
        now: iso(),
        expiresAt: later(SESSION_HOURS * 3_600_000),
        userAgent: String(userAgent || '').slice(0, 200),
      });
      await adminRepository.audit({
        actor: user.email,
        action: 'auth.login',
        entity: 'user',
        entityId: user.id,
        now: iso(),
      });
      return {
        token,
        user: publicUser(user),
      };
    },
    /** Resolve a session cookie. Sliding expiry, refreshed at most every 5 minutes. */
    async authenticate(token) {
      if (!token) return null;
      const session = await adminRepository.findSession(sha256(token));
      if (!session) return null;
      if (session.expiresAt < iso() || !session.user?.active) {
        await adminRepository.deleteSession(session.idHash);
        return null;
      }
      if (now().getTime() - new Date(session.lastSeenAt).getTime() > 5 * 60_000)
        await adminRepository.touchSession(session.idHash, iso(), later(SESSION_HOURS * 3_600_000));
      return publicUser(session.user);
    },
    async logout(token) {
      if (token) await adminRepository.deleteSession(sha256(token));
    },
    requireRole(user, role) {
      if (role === 'owner' && user.role !== 'owner') throw forbidden('Only owners can do this.');
    },
    purgeExpired: async () => await adminRepository.purgeSessions(iso()),
    auditLog: async (limit) => await adminRepository.auditLog(limit),
    audit: async (actor, action, entity, entityId, data) =>
      await adminRepository.audit({
        actor: typeof actor === 'string' ? actor : actor?.email || 'system',
        action,
        entity,
        entityId,
        data,
        now: iso(),
      }),
  };
}
