export interface Account {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshToken {
  id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: string;
}
