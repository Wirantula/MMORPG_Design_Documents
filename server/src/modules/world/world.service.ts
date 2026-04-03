import { Injectable, Logger } from '@nestjs/common';
import * as seedData from '../../../../tools/content/world-seed.json';

// ── Types ────────────────────────────────────────────────────────

export type WorldNodeType = 'universe' | 'planet' | 'plane' | 'region' | 'settlement_zone';
export type UnlockStatus = 'locked' | 'unlocked';

export interface WorldNode {
  id: string;
  name: string;
  type: WorldNodeType;
  parent_id: string | null;
  environmental_tags: string[];
  travel_cost: number;
  unlock_status: UnlockStatus;
}

export interface WorldEdge {
  from_node_id: string;
  to_node_id: string;
  travel_time_minutes: number;
  currency_cost: number;
  hazard_level: number;
}

export interface WorldSeedData {
  nodes: WorldNode[];
  edges: WorldEdge[];
}

// ── Service ──────────────────────────────────────────────────────

@Injectable()
export class WorldService {
  private readonly logger = new Logger(WorldService.name);
  private readonly nodes = new Map<string, WorldNode>();
  private readonly edges: WorldEdge[] = [];

  constructor() {
    this.loadSeed(seedData as WorldSeedData);
  }

  // ── Seed loading ─────────────────────────────────────────────

  loadSeed(data: WorldSeedData): void {
    this.nodes.clear();
    this.edges.length = 0;

    for (const node of data.nodes) {
      this.nodes.set(node.id, { ...node });
    }
    for (const edge of data.edges) {
      this.edges.push({ ...edge });
    }

    this.logger.log(
      `World seeded: ${this.nodes.size} nodes, ${this.edges.length} edges`,
      'WorldService',
    );
  }

  // ── Node queries ─────────────────────────────────────────────

  getAllNodes(): WorldNode[] {
    return [...this.nodes.values()];
  }

  getNodeById(id: string): WorldNode | undefined {
    return this.nodes.get(id);
  }

  getNodesByType(type: WorldNodeType): WorldNode[] {
    const results: WorldNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.type === type) results.push(node);
    }
    return results;
  }

  getChildNodes(parentId: string): WorldNode[] {
    const results: WorldNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.parent_id === parentId) results.push(node);
    }
    return results;
  }

  // ── Edge / connection queries ────────────────────────────────

  getConnections(nodeId: string): WorldEdge[] {
    return this.edges.filter(
      (e) => e.from_node_id === nodeId || e.to_node_id === nodeId,
    );
  }

  getOutgoingConnections(nodeId: string): WorldEdge[] {
    return this.edges.filter((e) => e.from_node_id === nodeId);
  }

  getAllEdges(): WorldEdge[] {
    return [...this.edges];
  }

  // ── Mutations ────────────────────────────────────────────────

  addNode(node: WorldNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node ${node.id} already exists`);
    }
    this.nodes.set(node.id, { ...node });
    this.logger.log(
      `Node added: ${node.id} (${node.type})`,
      'WorldService',
    );
  }

  addEdge(edge: WorldEdge): void {
    if (!this.nodes.has(edge.from_node_id)) {
      throw new Error(`Source node ${edge.from_node_id} does not exist`);
    }
    if (!this.nodes.has(edge.to_node_id)) {
      throw new Error(`Target node ${edge.to_node_id} does not exist`);
    }
    this.edges.push({ ...edge });
    this.logger.log(
      `Edge added: ${edge.from_node_id} -> ${edge.to_node_id}`,
      'WorldService',
    );
  }

  unlockNode(nodeId: string, triggerType: string): WorldNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    if (node.unlock_status === 'unlocked') {
      return node;
    }
    node.unlock_status = 'unlocked';

    this.logger.log(
      JSON.stringify({
        event: 'world_node_unlocked',
        node_id: nodeId,
        trigger_type: triggerType,
      }),
      'WorldService',
    );

    return node;
  }

  // ── Stats ────────────────────────────────────────────────────

  getNodeCount(): number {
    return this.nodes.size;
  }

  getEdgeCount(): number {
    return this.edges.length;
  }
}
