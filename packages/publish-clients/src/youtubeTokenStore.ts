import { createAccountStore, type StoredAccount } from "./accountStore";

export interface YouTubeTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix ms, когда истекает access_token */
  accessExpiresAt: number;
}

export type YouTubeAccount = StoredAccount<YouTubeTokens>;

const store = createAccountStore<YouTubeTokens>("youtube", "YouTube #1");

export const saveYouTubeAccount = store.save;
export const loadYouTubeAccount = store.load;
export const listYouTubeAccounts = store.list;
export const removeYouTubeAccount = store.remove;
export const updateYouTubeAccountTokens = store.updateTokens;
