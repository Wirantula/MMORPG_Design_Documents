import {
  Controller,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CharactersService, AliveCharacterExistsError } from './characters.service';

// ── Request DTOs ──────────────────────────────────────────────────

interface CreateCharacterBody {
  accountId: string;
  name: string;
}

// ── Player-facing controller ──────────────────────────────────────

@Controller('characters')
export class CharactersController {
  private readonly logger = new Logger(CharactersController.name);

  constructor(private readonly charactersService: CharactersService) {}

  /**
   * POST /api/characters
   * Creates a new living character for the authenticated account.
   * Returns 409 if the account already has a living character.
   */
  @Post()
  create(@Body() body: CreateCharacterBody) {
    try {
      const character = this.charactersService.createCharacter(
        body.accountId,
        body.name,
      );
      return { character };
    } catch (err) {
      if (err instanceof AliveCharacterExistsError) {
        throw new HttpException(
          { error: 'Conflict', message: err.message },
          HttpStatus.CONFLICT,
        );
      }
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

// ── Admin controller (RBAC-gated stub) ────────────────────────────

@Controller('admin/accounts')
export class AdminCharactersController {
  private readonly logger = new Logger(AdminCharactersController.name);

  constructor(private readonly charactersService: CharactersService) {}

  /**
   * POST /api/admin/accounts/:id/reset-character
   * Stub endpoint — will be RBAC-gated when the auth layer is extended.
   * Force-kills the account's alive character so a new one can be created.
   */
  @Post(':id/reset-character')
  resetCharacter(@Param('id') accountId: string) {
    // TODO: wire up RBAC guard (e.g. @UseGuards(AdminRbacGuard))
    const result = this.charactersService.resetCharacter(accountId);

    this.logger.log(
      `Admin reset-character: account=${accountId} reset=${result.reset}`,
      'AdminCharactersController',
    );

    return { ok: true, ...result };
  }
}
