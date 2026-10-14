/**
 * The model layer for the demo: an injectable service standing in for a
 * backend. Latency is simulated so TanStack Query's loading/refetch states
 * are real — in an actual app this class wraps fetch/axios and nothing else
 * changes.
 */
import { Injectable } from '@solid-mvc/core';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  lastActive: string; // ISO
}

export interface Metric {
  label: string;
  value: number;
  delta: number; // % vs last period
}

export interface ActivityItem {
  id: number;
  actor: string;
  action: string;
  at: string; // ISO
}

const NAMES = [
  'Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Edsger Dijkstra',
  'Barbara Liskov', 'Donald Knuth', 'Radia Perlman', 'Linus Torvalds',
  'Margaret Hamilton', 'Dennis Ritchie', 'Frances Allen', 'Ken Thompson',
];

const ROLES: User['role'][] = ['admin', 'editor', 'viewer'];
const STATUSES: User['status'][] = ['active', 'active', 'active', 'invited', 'suspended'];

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class FakeApi {
  private userRows: User[] = NAMES.map((name, i) => ({
    id: i + 1,
    name,
    email: `${name.toLowerCase().split(' ').join('.')}@acme.dev`,
    role: ROLES[i % 3],
    status: STATUSES[i % 5],
    lastActive: new Date(Date.now() - i * 3_600_000 * (i + 1)).toISOString(),
  }));

  private series = [4200, 5100, 4700, 6300, 5900, 7200, 8100, 7800, 9200, 8600, 9800, 10400];

  async metrics(): Promise<Metric[]> {
    await delay(350);
    return [
      { label: 'Revenue', value: 104_200, delta: 12.4 },
      { label: 'Active users', value: 8_431, delta: 4.1 },
      { label: 'Orders', value: 1_284, delta: -2.3 },
      { label: 'Conversion', value: 3.6, delta: 0.8 },
    ];
  }

  async revenueSeries(): Promise<number[]> {
    await delay(500);
    return this.series;
  }

  async users(search = ''): Promise<User[]> {
    await delay(400);
    const q = search.toLowerCase();
    return this.userRows.filter(
      (u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q),
    );
  }

  async activity(): Promise<ActivityItem[]> {
    await delay(300);
    const now = Date.now();
    return [
      'deployed release 4.2.0',
      'invited margaret@acme.dev',
      'closed incident #812',
      'updated billing plan',
      'merged PR "worker islands"',
      'rotated API keys',
    ].map((action, i) => ({
      id: i + 1,
      actor: NAMES[i],
      action,
      at: new Date(now - (i + 1) * 4_300_000).toISOString(),
    }));
  }
}
