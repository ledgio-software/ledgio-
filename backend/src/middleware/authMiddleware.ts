import { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, JwtPayload } from '../utils/jwt';

export interface AuthMiddlewareOptions {
  optional?: boolean;
}

/**
 * Express Middleware to authenticate incoming requests via JWT token.
 * Token can be passed in `Authorization: Bearer <token>` header or `X-Auth-Token` header.
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);

    if (!authHeader) {
      if (options.optional) {
        return next();
      }
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authorization header. Bearer token required.',
      });
      return;
    }

    let token = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    try {
      const payload: JwtPayload = await verifyJwtToken(token);
      // A pending-MFA token (issued after password verification, before the
      // TOTP/backup-code step) proves the password was correct but not that
      // MFA was completed - it must never be accepted as a real session by
      // any protected route, only by POST /auth/login/verify-mfa itself.
      if (payload.mfaPending) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'MFA verification required before this token can be used.',
        });
        return;
      }
      req.user = payload;

      // Privileged roles must have MFA enabled. Exempt: MFA setup/disable routes
      // so an admin who has not yet enrolled can actually reach the setup flow.
      // These paths are exempt from MFA enforcement so Admin/Auditor users can
      // reach MFA setup and basic profile even before enabling 2FA. Infrastructure
      // routes (sync, notifications) are also exempt — they don't expose financial
      // data and blocking them breaks the app shell entirely. Use req.originalUrl
      // (always the full path) because req.path is relative to the router mount
      // point and would not match these prefixes.
      const MFA_EXEMPT_PATHS = [
        '/auth/me',
        '/auth/mfa/setup',
        '/auth/mfa/verify-setup',
        '/auth/mfa/disable',
        '/auth/login/verify-mfa',
        '/auth/logout',
        '/auth/profile',
        // Sync + notification infrastructure — exempt so the app shell works
        '/sync/ticket',
        '/sync/bootstrap',
        '/sync/changes',
        '/notifications',
        // Tenant + subscription shell routes — exempt so the user can reach
        // Settings → Security to enable MFA; these don't expose financial data.
        '/tenants/current',
        '/tenants/members',
        '/subscription/status',
      ];
      // MFA is only enforced once the tenant has completed onboarding (isLive = true).
      // This lets new admins finish the setup wizard before being gated. Once live,
      // Admin/Auditor roles must have MFA enabled to access any financial data.
      if (
        process.env.NODE_ENV !== 'test' &&
        payload.isLive === true &&
        ['Admin', 'Auditor'].includes(payload.role ?? '') &&
        !payload.isMfaEnabled &&
        !MFA_EXEMPT_PATHS.some((p) => req.originalUrl.includes(p))
      ) {
        res.status(403).json({
          success: false,
          error:
            'Administrators and Auditors must enable two-factor authentication before accessing the system. Set it up in Settings → Security.',
          code: 'MFA_REQUIRED',
        });
        return;
      }

      next();
    } catch (error: any) {
      if (options.optional) {
        return next();
      }
      res.status(401).json({
        error: 'Unauthorized',
        message: error.message || 'Invalid authentication token.',
      });
    }
  };
}

export const authenticateJwt = createAuthMiddleware({ optional: false });
export const optionalAuthenticateJwt = createAuthMiddleware({ optional: true });
