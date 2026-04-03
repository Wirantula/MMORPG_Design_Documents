import { Injectable } from '@nestjs/common';

// ── Canonical domain event types ──────────────────────────────────

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  eventId: string;
  type: TType;
  timestamp: string;
  payload: TPayload;
}

export interface TickCompletedPayload {
  gameDay: number;
  worldUtc: string;
  realtimeUtc: string;
  driftMs: number;
}

export interface ActionSubmittedPayload {
  characterId: string;
  definitionId: string;
  startedAtWorldMs: number;
  endsAtWorldMs: number;
}

export interface ActionResolvedPayload {
  characterId: string;
  definitionId: string;
  completedAtWorldMs: number;
  rewards: Record<string, unknown>;
}

export interface ActionCancelledPayload {
  characterId: string;
  definitionId: string;
  cancelledAtWorldMs: number;
}

export interface OfflineReportGeneratedPayload {
  characterId: string;
  offlineDurationMs: number;
  actionsCompleted: number;
  totalXpEarned: number;
  warnings: string[];
}

export interface MarketTradeExecutedPayload {
  listingId: string;
  orderId: string;
  canonicalId: string;
  sellerId: string;
  buyerId: string;
  price: number;
  quantity: number;
  fee: number;
}

export interface ContractCompletedPayload {
  contractId: string;
  type: string;
  offererId: string;
  acceptorId: string;
  escrowAmount: number;
}

export interface ContractBreachedPayload {
  contractId: string;
  type: string;
  breachedById: string;
  nonBreachingId: string;
  escrowAmount: number;
}

export interface CurrencyTransferredPayload {
  transactionId: string;
  fromId: string | null;
  toId: string | null;
  currencyId: string;
  amount: number;
  reason: string;
}

export interface EconomyExportCompletedPayload {
  filePath: string;
  rowCount: number;
  gameDay: number;
}

export interface AccountCreatedPayload {
  accountId: string;
}

export interface AccountLoggedInPayload {
  accountId: string;
}

export interface CharacterBornPayload {
  accountId: string;
  characterId: string;
  wheelOutcomes: {
    race: string;
    aptitude: string;
    trait: string;
    origin: string;
    omen?: string;
  };
}

export interface CharacterDiedPayload {
  accountId: string;
  characterId: string;
  reason: string;
}

export interface ConnectionEstablishedPayload {
  accountId: string;
  socketId: string;
}

export interface ConnectionClosedPayload {
  accountId: string;
  socketId: string;
  reason: string;
}

export interface StatsInitialisedPayload {
  characterId: string;
  statFamilyCount: number;
  potentialKeyCount: number;
}

export interface LifeStageTransitionPayload {
  characterId: string;
  previousStage: string;
  newStage: string;
  ageInGameYears: number;
  gameDay: number;
}

export interface NeedsCriticalWarningPayload {
  characterId: string;
  dimension: string;
  value: number;
  gameDay: number;
}

export interface ConditionAppliedPayload {
  characterId: string;
  conditionId: string;
  conditionType: string;
  severity: number;
  durationDays: number;
}

export interface ConditionResolvedPayload {
  characterId: string;
  conditionId: string;
  conditionType: string;
  severity: number;
}

export type TickCompleted = DomainEvent<'TickCompleted', TickCompletedPayload>;
export type ActionSubmitted = DomainEvent<'ActionSubmitted', ActionSubmittedPayload>;
export type ActionResolved = DomainEvent<'ActionResolved', ActionResolvedPayload>;
export type ActionCancelled = DomainEvent<'ActionCancelled', ActionCancelledPayload>;
export type OfflineReportGenerated = DomainEvent<'OfflineReportGenerated', OfflineReportGeneratedPayload>;
export type MarketTradeExecuted = DomainEvent<'MarketTradeExecuted', MarketTradeExecutedPayload>;
export type ContractCompleted = DomainEvent<'ContractCompleted', ContractCompletedPayload>;
export type ContractBreached = DomainEvent<'ContractBreached', ContractBreachedPayload>;
export type CurrencyTransferred = DomainEvent<'CurrencyTransferred', CurrencyTransferredPayload>;
export type EconomyExportCompleted = DomainEvent<'EconomyExportCompleted', EconomyExportCompletedPayload>;
export type AccountCreated = DomainEvent<'AccountCreated', AccountCreatedPayload>;
export type AccountLoggedIn = DomainEvent<'AccountLoggedIn', AccountLoggedInPayload>;
export type CharacterBorn = DomainEvent<'CharacterBorn', CharacterBornPayload>;
export type CharacterDied = DomainEvent<'CharacterDied', CharacterDiedPayload>;
export type ConnectionEstablished = DomainEvent<'ConnectionEstablished', ConnectionEstablishedPayload>;
export type ConnectionClosed = DomainEvent<'ConnectionClosed', ConnectionClosedPayload>;
export type StatsInitialised = DomainEvent<'StatsInitialised', StatsInitialisedPayload>;
export type LifeStageTransition = DomainEvent<'LifeStageTransition', LifeStageTransitionPayload>;
export type NeedsCriticalWarning = DomainEvent<'NeedsCriticalWarning', NeedsCriticalWarningPayload>;
export type ConditionApplied = DomainEvent<'ConditionApplied', ConditionAppliedPayload>;
export type ConditionResolved = DomainEvent<'ConditionResolved', ConditionResolvedPayload>;

export type KnownDomainEvent =
  | TickCompleted
  | ActionSubmitted
  | ActionResolved
  | ActionCancelled
  | OfflineReportGenerated
  | MarketTradeExecuted
  | CurrencyTransferred
  | ContractCompleted
  | ContractBreached
  | EconomyExportCompleted
  | AccountCreated
  | AccountLoggedIn
  | CharacterBorn
  | CharacterDied
  | ConnectionEstablished
  | ConnectionClosed
  | StatsInitialised
  | LifeStageTransition
  | NeedsCriticalWarning
  | ConditionApplied
  | ConditionResolved;

// ── Listener signature ────────────────────────────────────────────

type Listener<T extends KnownDomainEvent = KnownDomainEvent> = (event: T) => void;

// ── In-process event bus ──────────────────────────────────────────

let counter = 0;

export function generateEventId(): string {
  counter += 1;
  return `evt_${Date.now()}_${counter}`;
}

@Injectable()
export class DomainEventBus {
  private readonly listeners = new Map<string, Listener[]>();

  on<T extends KnownDomainEvent>(type: T['type'], listener: Listener<T>): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener as Listener);
    this.listeners.set(type, existing);
  }

  off<T extends KnownDomainEvent>(type: T['type'], listener: Listener<T>): void {
    const existing = this.listeners.get(type);
    if (!existing) return;
    this.listeners.set(
      type,
      existing.filter((l) => l !== listener),
    );
  }

  emit<T extends KnownDomainEvent>(event: T): void {
    const existing = this.listeners.get(event.type);
    if (!existing) return;
    for (const listener of existing) {
      listener(event);
    }
  }
}
