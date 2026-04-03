import { Injectable, Logger } from '@nestjs/common';
import type { LifeStage } from '../../characters/lifecycle/lifecycle.service';

// ── Household types ───────────────────────────────────────────────

export interface HouseholdState {
  foodSupplied: boolean;
  shelterProvided: boolean;
  lastCheckedGameDay: number;
}

export interface FamilyRecord {
  familyId: string;
  characterId: string;
  guardianNpcId: string;
  householdState: HouseholdState;
  createdAtGameDay: number;
}

export interface SafetyAlert {
  familyId: string;
  characterId: string;
  reason: string;
  gameDay: number;
  timestamp: string;
}

// ── Service ───────────────────────────────────────────────────────

@Injectable()
export class FamilyService {
  private readonly logger = new Logger(FamilyService.name);

  /** In-memory family registry – production reads from families table. */
  private readonly families = new Map<string, FamilyRecord>();

  /** Alerts raised this session (append-only). */
  private readonly alerts: SafetyAlert[] = [];

  // ── Registration ──────────────────────────────────────────────

  /**
   * Create a family record for a new-born character.
   * The guardian NPC is auto-assigned.
   */
  createFamily(characterId: string, createdAtGameDay: number): FamilyRecord {
    const familyId = `fam_${characterId}`;
    const record: FamilyRecord = {
      familyId,
      characterId,
      guardianNpcId: `npc_guardian_${characterId}`,
      householdState: {
        foodSupplied: true,
        shelterProvided: true,
        lastCheckedGameDay: createdAtGameDay,
      },
      createdAtGameDay,
    };
    this.families.set(characterId, record);
    return record;
  }

  getFamily(characterId: string): FamilyRecord | undefined {
    return this.families.get(characterId);
  }

  getAlerts(): readonly SafetyAlert[] {
    return this.alerts;
  }

  // ── Tick resolution ───────────────────────────────────────────

  /**
   * Resolve family support for all registered families.
   * Called once per game-day from the tick loop.
   *
   * For infant/child stages the guardian NPC provides food and shelter.
   * If either is missing, a safety alert is raised.
   */
  resolveFamilySupport(
    currentGameDay: number,
    getStage: (characterId: string) => LifeStage | undefined,
  ): void {
    for (const record of this.families.values()) {
      const stage = getStage(record.characterId);
      if (!stage) continue;

      // Family NPC only provides for infant and child stages
      if (stage === 'infant' || stage === 'child') {
        record.householdState.foodSupplied = true;
        record.householdState.shelterProvided = true;
        record.householdState.lastCheckedGameDay = currentGameDay;

        this.logger.log(
          `Family support provided for ${record.characterId} (stage=${stage}, day=${currentGameDay})`,
          'FamilyService',
        );
      }

      // Check for neglect (could happen if household state was tampered or
      // the NPC failed to provide in a future expansion)
      if (
        (stage === 'infant' || stage === 'child') &&
        (!record.householdState.foodSupplied || !record.householdState.shelterProvided)
      ) {
        this.triggerSafetyAlert(record, currentGameDay);
      }
    }
  }

  /**
   * Raise a safety alert when a protected character is neglected.
   */
  triggerSafetyAlert(record: FamilyRecord, gameDay: number): SafetyAlert {
    const reasons: string[] = [];
    if (!record.householdState.foodSupplied) reasons.push('food_missing');
    if (!record.householdState.shelterProvided) reasons.push('shelter_missing');

    const alert: SafetyAlert = {
      familyId: record.familyId,
      characterId: record.characterId,
      reason: reasons.join(',') || 'neglect',
      gameDay,
      timestamp: new Date().toISOString(),
    };

    this.alerts.push(alert);
    this.logger.warn(
      `SafetyAlert family=${record.familyId} character=${record.characterId} reason=${alert.reason}`,
      'FamilyService',
    );

    return alert;
  }

  /**
   * Simulate neglect for a character (test/admin helper).
   * Sets foodSupplied or shelterProvided to false so the next
   * resolveFamilySupport call will trigger a safety alert.
   */
  simulateNeglect(
    characterId: string,
    neglectType: 'food' | 'shelter' | 'both',
  ): void {
    const record = this.families.get(characterId);
    if (!record) throw new Error(`No family record for ${characterId}`);

    if (neglectType === 'food' || neglectType === 'both') {
      record.householdState.foodSupplied = false;
    }
    if (neglectType === 'shelter' || neglectType === 'both') {
      record.householdState.shelterProvided = false;
    }
  }
}
