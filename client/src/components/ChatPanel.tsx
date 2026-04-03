'use client';

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../lib/contracts';

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  error: string | null;
}

export function ChatPanel({ messages, onSend, loading, error }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <section className="panel" aria-label="Chat" tabIndex={0} style={{ display: 'flex', flexDirection: 'column' }}>
      <h2>Chat</h2>

      {error && <p role="alert" style={{ color: '#ff6b6b' }}>⚠ {error}</p>}

      <div
        style={{ flex: 1, overflowY: 'auto', maxHeight: '16rem', marginBottom: '0.5rem' }}
        role="log"
        aria-live="polite"
      >
        {loading && messages.length === 0 && (
          <p className="muted">Connecting to chat…</p>
        )}

        {messages.map((msg, i) => (
          <p key={`${msg.sentAt}-${i}`} style={{ margin: '0.15rem 0' }}>
            <span className="muted">[{msg.channel}]</span>{' '}
            <strong>{msg.sender}:</strong> {msg.text}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          aria-label="Chat message input"
          style={{
            flex: 1,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: '4px',
            padding: '0.4rem 0.5rem',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          style={{
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            padding: '0.4rem 0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Send
        </button>
      </form>
    </section>
  );
}
