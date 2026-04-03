import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Guard that extracts and validates the Bearer JWT from the Authorization
 * header. Attaches `req.accountId` for downstream handlers.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; accountId?: string }>();
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const accountId = this.authService.verifyAccessToken(token);
    if (!accountId) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    req.accountId = accountId;
    return true;
  }
}
