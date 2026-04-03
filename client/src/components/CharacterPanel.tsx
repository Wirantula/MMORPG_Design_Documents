'use client';

import type { CharacterState } from '../lib/contracts';

export interface CharacterPanelProps {
  character: CharacterState | null;
  loading: boolean;
  error: string | null;
}

export function CharacterPanel({ character, loading, error }: CharacterPanelProps) {
  return (
    <section className="panel" aria-label="Character" tabIndex={0}>
      <h2>Character</h2>

      {loading && <p className="muted">Loading character…</p>}

      {error && <p role="alert" style={{ color: '#ff6b6b' }}>⚠ {error}</p>}

      {!loading && !error && !character && (
        <p className="muted">No character data yet.</p>
      )}

      {character && (
        <>
          <p>Name: <strong>{character.name}</strong></p>
          <p>Stage: <strong>{character.stage}</strong></p>
          <p>Settlement: <strong>{character.settlement}</strong></p>
          <p>Node: <strong>{character.node}</strong></p>
          {Object.keys(character.stats).length > 0 && (
            <div>
              <p className="muted">Stats:</p>
              {Object.entries(character.stats).map(([key, value]) => (
                <div className="row" key={key}>
                  <span>{key}</span>
                  <span><strong>{value}</strong></span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
