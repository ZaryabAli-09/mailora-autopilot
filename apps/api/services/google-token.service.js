import { OAuth2Client } from "google-auth-library";
import { ApiError } from "../utils/apiError.js";
import { decryptTokens, encryptTokens } from "../utils/token-vault.js";

export const requestedScopes = [
  "openid",
  "email",
  "profile",
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const broadScope = "https://mail.google.com/";
const legacyScopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];
const refreshes = new Map();

export function hasGmailAccess(scope = "") {
  const granted = new Set(scope.split(/\s+/).filter(Boolean));
  return granted.has(broadScope) || legacyScopes.every((item) => granted.has(item));
}

export function googleClient() {
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"]) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL,
  );
}

export function reconnectError() {
  const error = new ApiError(409, "Connect Gmail again to continue");
  error.code = "GMAIL_RECONNECT";
  return error;
}

export async function invalidateGmailAccess(user) {
  user.encryptedGmailTokens = undefined;
  await user.save();
  throw reconnectError();
}

export async function accessTokenFor(user, { forceRefresh = false } = {}) {
  if (!user.encryptedGmailTokens) throw reconnectError();
  let tokens;
  try { tokens = decryptTokens(user.encryptedGmailTokens); } catch { throw reconnectError(); }
  if (!hasGmailAccess(tokens.scope)) throw reconnectError();
  if (!tokens.refresh_token) throw reconnectError();
  if (!forceRefresh && tokens.access_token && Number(tokens.expiry_date) > Date.now() + 60_000) {
    return tokens.access_token;
  }
  const key = String(user.id || user._id || user);
  if (refreshes.has(key)) return refreshes.get(key);
  const refreshing = (async () => {
    try {
      const client = googleClient();
      client.setCredentials({ refresh_token: tokens.refresh_token });
      const { credentials } = await client.refreshAccessToken();
      if (!credentials.access_token) throw new Error("No access token returned");
      user.encryptedGmailTokens = encryptTokens({
        ...tokens,
        ...credentials,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
      });
      await user.save();
      return credentials.access_token;
    } catch (error) {
      const providerCode = error.response?.data?.error;
      if (providerCode === "invalid_grant" || providerCode === "invalid_token") {
        await invalidateGmailAccess(user);
      }
      throw new ApiError(503, "Could not refresh Gmail access right now");
    }
  })();
  refreshes.set(key, refreshing);
  try { return await refreshing; }
  finally { if (refreshes.get(key) === refreshing) refreshes.delete(key); }
}
