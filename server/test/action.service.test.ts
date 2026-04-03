import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ActionService } from '../src/modules/simulation/actions/action.service';
import { SimulationService } from '../src/modules/simulation/simulation.service';
import { DomainEventBus } from '../src/common/domain-events';

function createService() {
  const eventBus = new DomainEventBus();
  const simulation = new SimulationService({ acceleration: 30 });
  const actionService = new ActionService(eventBus, simulation);
  return { actionService, eventBus, simulation };
}

describe('ActionService', () => {
  let svc: ReturnType<typeof createService>;

  beforeEach(() => {
    svc = createService();
  });

  // ── startAction ─────────────────────────────────────────────

  it('starts an action and returns a slot', () => {
    const result = svc.actionService.startAction('char-1', 'forage');
    expect(result.ok).toBe(true);
    expect(result.slot).toBeDefined();
    expect(result.slot!.definitionId).toBe('forage');
    expect(result.slot!.state).toBe('active');
  });

  it('emits ActionSubmitted domain event on start', () => {
    const listener = vi.fn();
    svc.eventBus.on('ActionSubmitted', listener);

    svc.actionService.startAction('char-1', 'forage');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].payload.definitionId).toBe('forage');
  });

  it('rejects unknown action definition', () => {
    const result = svc.actionService.startAction('char-1', 'nonexistent');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown action definition');
  });

  it('rejects double-start (character already busy)', () => {
    svc.actionService.startAction('char-1', 'forage');
    const result = svc.actionService.startAction('char-1', 'rest');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('already has an active');
  });

  it('allows start after previous action completed', () => {
    const nowMs = Date.now();
    svc.actionService.startAction('char-1', 'forage', nowMs);

    // Fast-forward enough real-time for the action to complete at 30x accel
    // forage = 4 game-hours = 4*3600*1000 = 14_400_000 world-ms
    // At 30x: 14_400_000 / 30 = 480_000 real-ms
    const futureMs = nowMs + 480_001;
    svc.actionService.tickActions(futureMs);

    const slot = svc.actionService.getSlot('char-1');
    expect(slot!.state).toBe('completed');

    const result = svc.actionService.startAction('char-1', 'rest', futureMs);
    expect(result.ok).toBe(true);
  });

  // ── cancelAction ────────────────────────────────────────────

  it('cancels an active action', () => {
    svc.actionService.startAction('char-1', 'forage');
    const result = svc.actionService.cancelAction('char-1');
    expect(result.ok).toBe(true);
    expect(result.slot!.state).toBe('cancelled');
  });

  it('emits ActionCancelled domain event', () => {
    const listener = vi.fn();
    svc.eventBus.on('ActionCancelled', listener);

    svc.actionService.startAction('char-1', 'forage');
    svc.actionService.cancelAction('char-1');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('rejects cancel when no active action', () => {
    const result = svc.actionService.cancelAction('char-1');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No active or paused action');
  });

  // ── pauseAction / resumeAction ──────────────────────────────

  it('pauses and resumes an action preserving remaining time', () => {
    const nowMs = Date.now();
    svc.actionService.startAction('char-1', 'forage', nowMs);

    // Pause after some real-time passes
    const pauseMs = nowMs + 100_000; // 100s real = 3_000_000 world-ms at 30x
    const pauseResult = svc.actionService.pauseAction('char-1', pauseMs);
    expect(pauseResult.ok).toBe(true);
    expect(pauseResult.slot!.state).toBe('paused');

    // Resume later
    const resumeMs = pauseMs + 50_000;
    const resumeResult = svc.actionService.resumeAction('char-1', resumeMs);
    expect(resumeResult.ok).toBe(true);
    expect(resumeResult.slot!.state).toBe('active');

    // The remaining time should be the original duration minus what elapsed before pause
    const slot = resumeResult.slot!;
    const remainingWorldMs = slot.endsAtWorldMs - slot.startedAtWorldMs;
    // forage duration = 14_400_000 world-ms; elapsed before pause = 3_000_000 world-ms
    expect(remainingWorldMs).toBe(14_400_000 - 3_000_000);
  });

  it('rejects pause on non-active action', () => {
    const result = svc.actionService.pauseAction('char-1');
    expect(result.ok).toBe(false);
  });

  it('rejects resume on non-paused action', () => {
    svc.actionService.startAction('char-1', 'forage');
    const result = svc.actionService.resumeAction('char-1');
    expect(result.ok).toBe(false);
  });

  // ── tickActions ─────────────────────────────────────────────

  it('completes actions whose end time has passed', () => {
    const nowMs = Date.now();
    svc.actionService.startAction('char-1', 'forage', nowMs);

    const futureMs = nowMs + 500_000; // well past 4 game-hour forage
    const completed = svc.actionService.tickActions(futureMs);

    expect(completed.length).toBe(1);
    expect(completed[0].state).toBe('completed');
  });

  it('emits ActionResolved on completion', () => {
    const listener = vi.fn();
    svc.eventBus.on('ActionResolved', listener);

    const nowMs = Date.now();
    svc.actionService.startAction('char-1', 'forage', nowMs);
    svc.actionService.tickActions(nowMs + 500_000);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].payload.characterId).toBe('char-1');
  });

  it('does not complete actions that are still in progress', () => {
    const nowMs = Date.now();
    svc.actionService.startAction('char-1', 'forage', nowMs);
    const completed = svc.actionService.tickActions(nowMs + 1); // almost no time passed
    expect(completed.length).toBe(0);
  });

  it('does not complete paused actions', () => {
    const nowMs = Date.now();
    svc.actionService.startAction('char-1', 'forage', nowMs);
    svc.actionService.pauseAction('char-1', nowMs + 1000);
    const completed = svc.actionService.tickActions(nowMs + 999_999);
    expect(completed.length).toBe(0);
  });

  // ── getActiveCount ──────────────────────────────────────────

  it('tracks active count', () => {
    expect(svc.actionService.getActiveCount()).toBe(0);
    svc.actionService.startAction('char-1', 'forage');
    expect(svc.actionService.getActiveCount()).toBe(1);
    svc.actionService.startAction('char-2', 'rest');
    expect(svc.actionService.getActiveCount()).toBe(2);
    svc.actionService.cancelAction('char-1');
    expect(svc.actionService.getActiveCount()).toBe(1);
  });
});
