export type AccountRole = 'player' | 'admin';

export interface Account {
  id: string;
  email: string;
  passwordHash: string;
  role: AccountRole;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshToken {
  id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: string;
}
