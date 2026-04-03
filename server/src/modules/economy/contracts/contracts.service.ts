import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../common/logger.service';
import {
  DomainEventBus,
  generateEventId,
  type ContractCompleted,
  type ContractBreached,
} from '../../../common/domain-events';
import { MarketService } from '../market.service';
import type { Contract, ContractType } from '../economy.types';

let contractIdCounter = 0;
function nextContractId(): string {
  contractIdCounter += 1;
  return `ctr_${Date.now()}_${contractIdCounter}`;
}

@Injectable()
export class ContractsService {
  private readonly contracts = new Map<string, Contract>();

  constructor(
    private readonly logger: AppLogger,
    private readonly eventBus: DomainEventBus,
    private readonly marketService: MarketService,
  ) {}

  // ── Create ────────────────────────────────────────────────────

  createContract(params: {
    type: ContractType;
    offererId: string;
    termsJson: Record<string, unknown>;
    escrowAmount: number;
    deadlineGameDay: number;
    currentGameDay: number;
  }): Contract {
    if (params.escrowAmount < 0) throw new Error('Escrow amount must be non-negative');

    // Lock escrow from offerer's balance
    if (params.escrowAmount > 0) {
      if (!this.marketService.debitBalance(params.offererId, params.escrowAmount)) {
        throw new Error('Insufficient balance to cover escrow');
      }
    }

    const contract: Contract = {
      id: nextContractId(),
      type: params.type,
      offererId: params.offererId,
      acceptorId: null,
      termsJson: params.termsJson,
      escrowAmount: params.escrowAmount,
      status: 'open',
      deadlineGameDay: params.deadlineGameDay,
      createdAtGameDay: params.currentGameDay,
    };

    this.contracts.set(contract.id, contract);

    this.logger.log(
      `Contract ${contract.id} created by ${params.offererId} (type=${params.type}, escrow=${params.escrowAmount})`,
      'ContractsService',
    );

    return contract;
  }

  // ── Accept ────────────────────────────────────────────────────

  acceptContract(contractId: string, acceptorId: string): Contract {
    const contract = this.getContractOrThrow(contractId);
    if (contract.status !== 'open') {
      throw new Error(`Contract ${contractId} is not open (status=${contract.status})`);
    }
    if (contract.offererId === acceptorId) {
      throw new Error('Cannot accept your own contract');
    }

    contract.acceptorId = acceptorId;
    contract.status = 'accepted';

    this.logger.log(
      `Contract ${contractId} accepted by ${acceptorId}`,
      'ContractsService',
    );

    return contract;
  }

  // ── Complete ──────────────────────────────────────────────────

  completeContract(contractId: string): Contract {
    const contract = this.getContractOrThrow(contractId);
    if (contract.status !== 'accepted') {
      throw new Error(`Contract ${contractId} is not in accepted state`);
    }

    contract.status = 'completed';

    // Release escrow to acceptor
    if (contract.escrowAmount > 0 && contract.acceptorId) {
      this.marketService.creditBalance(contract.acceptorId, contract.escrowAmount);
    }

    const event: ContractCompleted = {
      eventId: generateEventId(),
      type: 'ContractCompleted',
      timestamp: new Date().toISOString(),
      payload: {
        contractId: contract.id,
        type: contract.type,
        offererId: contract.offererId,
        acceptorId: contract.acceptorId!,
        escrowAmount: contract.escrowAmount,
      },
    };
    this.eventBus.emit(event);

    this.logger.log(
      `Contract ${contractId} completed — escrow ${contract.escrowAmount} released to ${contract.acceptorId}`,
      'ContractsService',
    );

    return contract;
  }

  // ── Breach ────────────────────────────────────────────────────

  breachContract(contractId: string, breachedById: string): Contract {
    const contract = this.getContractOrThrow(contractId);
    if (contract.status !== 'accepted') {
      throw new Error(`Contract ${contractId} is not in accepted state`);
    }

    contract.status = 'breached';

    // Determine non-breaching party
    const nonBreachingId =
      breachedById === contract.offererId
        ? contract.acceptorId!
        : contract.offererId;

    // Release escrow to non-breaching party
    if (contract.escrowAmount > 0) {
      this.marketService.creditBalance(nonBreachingId, contract.escrowAmount);
    }

    const event: ContractBreached = {
      eventId: generateEventId(),
      type: 'ContractBreached',
      timestamp: new Date().toISOString(),
      payload: {
        contractId: contract.id,
        type: contract.type,
        breachedById,
        nonBreachingId,
        escrowAmount: contract.escrowAmount,
      },
    };
    this.eventBus.emit(event);

    this.logger.log(
      `Contract ${contractId} breached by ${breachedById} — escrow ${contract.escrowAmount} to ${nonBreachingId}`,
      'ContractsService',
    );

    return contract;
  }

  // ── Queries ───────────────────────────────────────────────────

  getContract(id: string): Contract | undefined {
    return this.contracts.get(id);
  }

  getActiveContracts(): Contract[] {
    const results: Contract[] = [];
    for (const c of this.contracts.values()) {
      if (c.status === 'open' || c.status === 'accepted') {
        results.push(c);
      }
    }
    return results;
  }

  getActiveContractCount(): number {
    return this.getActiveContracts().length;
  }

  // ── Internals ─────────────────────────────────────────────────

  private getContractOrThrow(id: string): Contract {
    const contract = this.contracts.get(id);
    if (!contract) throw new Error(`Contract ${id} not found`);
    return contract;
  }
}
