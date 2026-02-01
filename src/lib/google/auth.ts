const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJWT(
  payload: Record<string, unknown>,
  privateKeyPem: string,
  keyId: string
): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: keyId,
  };

  const headerEncoded = base64UrlEncode(strToUint8Array(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(strToUint8Array(JSON.stringify(payload)));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const keyData = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signingData = strToUint8Array(signingInput);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signingData.buffer as ArrayBuffer
  );

  const signatureEncoded = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${signatureEncoded}`;
}

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const keyId = process.env.GOOGLE_PRIVATE_KEY_ID;

  if (!email || !privateKey || !keyId) {
    throw new Error(
      "[auth] 環境変数が未設定です: " +
      [
        !email && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        !privateKey && "GOOGLE_PRIVATE_KEY",
        !keyId && "GOOGLE_PRIVATE_KEY_ID",
      ]
        .filter(Boolean)
        .join(", ")
    );
  }

  const resolvedPrivateKey = privateKey.replace(/\\n/g, "\n");

  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
  ].join(" ");

  const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;

  const payload: Record<string, unknown> = {
    iss: email,
    scope: scopes,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  if (impersonateEmail) {
    payload.sub = impersonateEmail;
  }

  const jwt = await signJWT(payload, resolvedPrivateKey, keyId);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
  };

  return data.access_token;
}
