import { describe, expect, it, beforeEach } from 'vitest';
import { WorldService } from '../src/modules/world/world.service';
import type { WorldSeedData, WorldNode, WorldEdge } from '../src/modules/world/world.service';

function minimalSeed(): WorldSeedData {
  return {
    nodes: [
      {
        id: 'universe-1',
        name: 'Test Universe',
        type: 'universe',
        parent_id: null,
        environmental_tags: ['digital'],
        travel_cost: 0,
        unlock_status: 'unlocked',
      },
      {
        id: 'planet-1',
        name: 'Planet Alpha',
        type: 'planet',
        parent_id: 'universe-1',
        environmental_tags: ['temperate'],
        travel_cost: 0,
        unlock_status: 'unlocked',
      },
      {
        id: 'plane-1',
        name: 'Surface',
        type: 'plane',
        parent_id: 'planet-1',
        environmental_tags: ['surface'],
        travel_cost: 0,
        unlock_status: 'unlocked',
      },
      {
        id: 'region-1',
        name: 'Meadow',
        type: 'region',
        parent_id: 'plane-1',
        environmental_tags: ['grassland'],
        travel_cost: 0,
        unlock_status: 'unlocked',
      },
      {
        id: 'region-2',
        name: 'Forest',
        type: 'region',
        parent_id: 'plane-1',
        environmental_tags: ['forest'],
        travel_cost: 10,
        unlock_status: 'locked',
      },
      {
        id: 'region-3',
        name: 'Mountain',
        type: 'region',
        parent_id: 'plane-1',
        environmental_tags: ['mountain'],
        travel_cost: 50,
        unlock_status: 'locked',
      },
    ],
    edges: [
      {
        from_node_id: 'region-1',
        to_node_id: 'region-2',
        travel_time_minutes: 10,
        currency_cost: 5,
        hazard_level: 1,
      },
      {
        from_node_id: 'region-1',
        to_node_id: 'region-3',
        travel_time_minutes: 30,
        currency_cost: 25,
        hazard_level: 4,
      },
      {
        from_node_id: 'region-2',
        to_node_id: 'region-3',
        travel_time_minutes: 20,
        currency_cost: 15,
        hazard_level: 3,
      },
    ],
  };
}

describe('WorldService', () => {
  let service: WorldService;

  beforeEach(() => {
    service = new WorldService();
    service.loadSeed(minimalSeed());
  });

  // ── Node lookup ──────────────────────────────────────────────

  it('loads all nodes from seed data', () => {
    expect(service.getNodeCount()).toBe(6);
    expect(service.getEdgeCount()).toBe(3);
  });

  it('returns all nodes via getAllNodes', () => {
    const nodes = service.getAllNodes();
    expect(nodes.length).toBe(6);
  });

  it('finds a node by id', () => {
    const node = service.getNodeById('region-1');
    expect(node).toBeDefined();
    expect(node!.name).toBe('Meadow');
    expect(node!.type).toBe('region');
  });

  it('returns undefined for unknown node id', () => {
    expect(service.getNodeById('nonexistent')).toBeUndefined();
  });

  it('filters nodes by type', () => {
    const regions = service.getNodesByType('region');
    expect(regions.length).toBe(3);
    for (const r of regions) {
      expect(r.type).toBe('region');
    }
  });

  it('returns child nodes for a given parent', () => {
    const children = service.getChildNodes('plane-1');
    expect(children.length).toBe(3);
    const ids = children.map((c) => c.id).sort();
    expect(ids).toEqual(['region-1', 'region-2', 'region-3']);
  });

  // ── Edge traversal ───────────────────────────────────────────

  it('returns all connections (bidirectional) for a node', () => {
    const edges = service.getConnections('region-1');
    expect(edges.length).toBe(2);
  });

  it('returns outgoing connections only', () => {
    const outgoing = service.getOutgoingConnections('region-1');
    expect(outgoing.length).toBe(2);
    for (const e of outgoing) {
      expect(e.from_node_id).toBe('region-1');
    }
  });

  it('returns connections that include the node as a target', () => {
    const edges = service.getConnections('region-3');
    // region-3 is a to_node in two edges: from region-1 and from region-2
    // and from_node in zero edges
    expect(edges.length).toBe(2);
  });

  it('returns empty array for node with no connections', () => {
    const edges = service.getConnections('universe-1');
    expect(edges.length).toBe(0);
  });

  it('returns all edges', () => {
    const edges = service.getAllEdges();
    expect(edges.length).toBe(3);
  });

  // ── Connection filtering ─────────────────────────────────────

  it('connections contain correct travel metadata', () => {
    const edges = service.getOutgoingConnections('region-1');
    const toForest = edges.find((e) => e.to_node_id === 'region-2');
    expect(toForest).toBeDefined();
    expect(toForest!.travel_time_minutes).toBe(10);
    expect(toForest!.currency_cost).toBe(5);
    expect(toForest!.hazard_level).toBe(1);
  });

  // ── Expansion without breaking existing nodes ────────────────

  it('adding a new node does not affect existing nodes', () => {
    const countBefore = service.getNodeCount();

    const newNode: WorldNode = {
      id: 'region-new',
      name: 'New Region',
      type: 'region',
      parent_id: 'plane-1',
      environmental_tags: ['desert'],
      travel_cost: 30,
      unlock_status: 'locked',
    };

    service.addNode(newNode);

    expect(service.getNodeCount()).toBe(countBefore + 1);
    expect(service.getNodeById('region-new')).toBeDefined();
    // Existing nodes unaffected
    expect(service.getNodeById('region-1')!.name).toBe('Meadow');
  });

  it('rejects duplicate node id', () => {
    expect(() =>
      service.addNode({
        id: 'region-1',
        name: 'Duplicate',
        type: 'region',
        parent_id: 'plane-1',
        environmental_tags: [],
        travel_cost: 0,
        unlock_status: 'locked',
      }),
    ).toThrow('already exists');
  });

  it('adding a new edge does not affect existing edges', () => {
    const edgesBefore = service.getEdgeCount();

    const newEdge: WorldEdge = {
      from_node_id: 'region-1',
      to_node_id: 'planet-1',
      travel_time_minutes: 60,
      currency_cost: 100,
      hazard_level: 2,
    };

    service.addEdge(newEdge);

    expect(service.getEdgeCount()).toBe(edgesBefore + 1);
    // Existing connections for region-1 still include the originals
    const outgoing = service.getOutgoingConnections('region-1');
    expect(outgoing.length).toBe(3); // 2 original + 1 new
  });

  it('rejects edge referencing nonexistent source node', () => {
    expect(() =>
      service.addEdge({
        from_node_id: 'nonexistent',
        to_node_id: 'region-1',
        travel_time_minutes: 10,
        currency_cost: 0,
        hazard_level: 0,
      }),
    ).toThrow('does not exist');
  });

  it('rejects edge referencing nonexistent target node', () => {
    expect(() =>
      service.addEdge({
        from_node_id: 'region-1',
        to_node_id: 'nonexistent',
        travel_time_minutes: 10,
        currency_cost: 0,
        hazard_level: 0,
      }),
    ).toThrow('does not exist');
  });

  // ── Unlock ───────────────────────────────────────────────────

  it('unlocks a locked node and logs trigger type', () => {
    const node = service.getNodeById('region-2');
    expect(node!.unlock_status).toBe('locked');

    const unlocked = service.unlockNode('region-2', 'quest_completion');
    expect(unlocked.unlock_status).toBe('unlocked');
    // Verify persisted in-memory
    expect(service.getNodeById('region-2')!.unlock_status).toBe('unlocked');
  });

  it('unlock is idempotent for already-unlocked nodes', () => {
    const result = service.unlockNode('region-1', 'manual');
    expect(result.unlock_status).toBe('unlocked');
  });

  it('unlock throws for nonexistent node', () => {
    expect(() => service.unlockNode('bad-id', 'test')).toThrow('not found');
  });

  // ── Default seed (world-seed.json) ───────────────────────────

  it('loads the production world-seed.json on construction', () => {
    const freshService = new WorldService();
    // world-seed.json has 16 nodes and 10 edges
    expect(freshService.getNodeCount()).toBe(16);
    expect(freshService.getEdgeCount()).toBe(10);
  });
});
