import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from './auth.dto';
import type { Request } from 'express';

// Rate limit: 10 requests per 60 seconds per IP on all auth endpoints.
@Throttle({ default: { ttl: 60_000, limit: 10 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.authService.register(parsed.data);
    if (!result.ok) {
      throw new HttpException(
        { message: result.error },
        result.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      accountId: result.accountId,
      accessToken: result.tokens!.accessToken,
      refreshToken: result.tokens!.refreshToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.authService.login(parsed.data);
    if (!result.ok) {
      throw new HttpException(
        { message: result.error },
        result.statusCode ?? HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      accountId: result.accountId,
      accessToken: result.tokens!.accessToken,
      refreshToken: result.tokens!.refreshToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: unknown, @Req() req: Request) {
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Extract account ID from the Authorization header (access token may be expired,
    // but we still need to know who is requesting the refresh).
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!accessToken) {
      throw new HttpException({ message: 'Missing Authorization header' }, HttpStatus.BAD_REQUEST);
    }

    // Decode without verification (access token may be expired)
    let accountId: string | undefined;
    try {
      const decoded = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64').toString(),
      ) as { sub?: string };
      accountId = decoded.sub;
    } catch {
      throw new HttpException({ message: 'Invalid access token' }, HttpStatus.BAD_REQUEST);
    }

    if (!accountId) {
      throw new HttpException({ message: 'Invalid access token payload' }, HttpStatus.BAD_REQUEST);
    }

    const result = await this.authService.refresh(accountId, parsed.data.refreshToken);
    if (!result.ok) {
      throw new HttpException(
        { message: result.error },
        result.statusCode ?? HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      accountId: result.accountId,
      accessToken: result.tokens!.accessToken,
      refreshToken: result.tokens!.refreshToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: unknown, @Req() req: Request) {
    const parsed = logoutSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        HttpStatus.BAD_REQUEST,
      );
    }

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!accessToken) {
      throw new HttpException({ message: 'Missing Authorization header' }, HttpStatus.BAD_REQUEST);
    }

    let accountId: string | undefined;
    try {
      const decoded = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64').toString(),
      ) as { sub?: string };
      accountId = decoded.sub;
    } catch {
      throw new HttpException({ message: 'Invalid access token' }, HttpStatus.BAD_REQUEST);
    }

    if (!accountId) {
      throw new HttpException({ message: 'Invalid access token payload' }, HttpStatus.BAD_REQUEST);
    }

    await this.authService.logout(accountId, parsed.data.refreshToken);
    return { ok: true };
  }
}
