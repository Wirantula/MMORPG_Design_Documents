import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AccountsService } from '../accounts/accounts.service';

/**
 * Guard that validates a Bearer JWT and checks that the account has the
 * 'admin' role.  Attaches `req.accountId` for downstream handlers.
 */
@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly accountsService: AccountsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; accountId?: string }>();

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const accountId = this.authService.verifyAccessToken(token);
    if (!accountId) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const account = this.accountsService.findById(accountId);
    if (!account || account.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    req.accountId = accountId;
    return true;
  }
}
