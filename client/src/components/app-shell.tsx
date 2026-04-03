'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { WsClient, type ServerEventEnvelope } from '../lib/ws-client';
import { makeCommandEnvelope, type CharacterState, type ActionEntry, type ChatMessage, type NotificationEntry, type WorldSnapshot } from '../lib/contracts';
import { CharacterPanel } from './CharacterPanel';
import { LocationPanel } from './LocationPanel';
import { ActionQueuePanel } from './ActionQueuePanel';
import { ChatPanel } from './ChatPanel';
import { NotificationsPanel } from './NotificationsPanel';

/** Maximum chat messages / notifications kept in memory. */
const MAX_CHAT = 200;
const MAX_NOTIFICATIONS = 50;

export function AppShell() {
  // ── Connection state ────────────────────────────────────────────
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  // ── Panel state ─────────────────────────────────────────────────
  const [character, setCharacter] = useState<CharacterState | null>(null);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [worldUtc, setWorldUtc] = useState('');
  const [realtimeUtc, setRealtimeUtc] = useState('');
  const [acceleration, setAcceleration] = useState(30);

  // Keep a ref to WsClient so callbacks don't stale-close over it.
  const wsRef = useRef<WsClient | null>(null);

  // ── Event router ────────────────────────────────────────────────
  const handleServerEvent = useCallback((envelope: ServerEventEnvelope) => {
    switch (envelope.type) {
      case 'character.update':
        setCharacter(envelope.payload as CharacterState);
        break;

      case 'world.snapshot':
      case 'tick': {
        const snap = envelope.payload as WorldSnapshot;
        setWorldUtc(snap.worldUtc);
        setRealtimeUtc(snap.realtimeUtc);
        setAcceleration(snap.acceleration);
        if (snap.actions) setActions(snap.actions);
        break;
      }

      case 'action.started':
      case 'action.resolved':
      case 'action.cancelled': {
        const entry = envelope.payload as ActionEntry;
        setActions((prev) => {
          const idx = prev.findIndex((a) => a.definitionId === entry.definitionId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = entry;
            return next;
          }
          return [...prev, entry];
        });
        break;
      }

      case 'chat.message': {
        const msg = envelope.payload as ChatMessage;
        setChatMessages((prev) => [...prev.slice(-MAX_CHAT + 1), msg]);
        break;
      }

      case 'notification': {
        const note = envelope.payload as NotificationEntry;
        setNotifications((prev) => [...prev.slice(-MAX_NOTIFICATIONS + 1), note]);
        break;
      }

      default:
        // ack / error / unknown — no panel update
        break;
    }
  }, []);

  // ── Lifecycle: connect WS on mount ──────────────────────────────
  useEffect(() => {
    const ws = WsClient.getInstance();
    wsRef.current = ws;

    const offOpen = ws.on('open', () => {
      setWsConnected(true);
      setWsError(null);
    });

    const offClose = ws.on('close', () => {
      setWsConnected(false);
    });

    const offError = ws.on('error', () => {
      setWsError('Connection error — retrying…');
    });

    const offMessage = ws.on('message', handleServerEvent);

    ws.connect();

    return () => {
      offOpen();
      offClose();
      offError();
      offMessage();
      ws.disconnect();
    };
  }, [handleServerEvent]);

  // ── Chat send handler ──────────────────────────────────────────
  const handleChatSend = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || !ws.connected) return;
    ws.sendCommand(makeCommandEnvelope('chat.send', { text }));
  }, []);

  // ── Derive per-panel loading / error ────────────────────────────
  const connectionLoading = !wsConnected && !wsError;

  return (
    <main className="page">
      <CharacterPanel
        character={character}
        loading={connectionLoading}
        error={wsError}
      />

      <LocationPanel
        settlement={character?.settlement ?? ''}
        node={character?.node ?? ''}
        worldUtc={worldUtc}
        realtimeUtc={realtimeUtc}
        acceleration={acceleration}
        loading={connectionLoading}
        error={wsError}
      />

      <ActionQueuePanel
        actions={actions}
        loading={connectionLoading}
        error={wsError}
      />

      <ChatPanel
        messages={chatMessages}
        onSend={handleChatSend}
        loading={connectionLoading}
        error={wsError}
      />

      <NotificationsPanel
        notifications={notifications}
        loading={connectionLoading}
        error={wsError}
      />

      <section className="panel" aria-label="Operational Status" tabIndex={0}>
        <h2>Operational Status</h2>
        <p>Client shell: <strong>{wsConnected ? 'connected' : 'reconnecting…'}</strong></p>
        <p>Contract mode: <strong>foundation</strong></p>
        <p>Observability: <span className="muted">console WS connect/disconnect logs</span></p>
      </section>
    </main>
  );
}
