import { createAccountStore, type StoredAccount } from "./accountStore";

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix ms, когда истекает access_token */
  accessExpiresAt: number;
  /** Unix ms, когда истекает refresh_token */
  refreshExpiresAt: number;
  openId: string;
  scope: string;
}

export type TikTokAccount = StoredAccount<TikTokTokens>;

const store = createAccountStore<TikTokTokens>("tiktok", "TikTok #1");

export const saveTikTokAccount = store.save;
export const loadTikTokAccount = store.load;
export const listTikTokAccounts = store.list;
export const removeTikTokAccount = store.remove;
export const updateTikTokAccountTokens = store.updateTokens;
