// Vérifie le mot de passe et pose un cookie de session signé (HMAC-SHA256).
// Le cookie ne contient jamais le mot de passe lui-même : uniquement une
// date d'expiration et une signature vérifiable côté serveur (middleware.js).

const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 jours

async function sign(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
          res.status(405).json({ error: "Méthode non autorisée" });
          return;
    }

  const { password } = req.body || {};

  if (!process.env.PASSWORD || !process.env.APP_SESSION_SECRET) {
        res.status(500).json({ error: "Configuration serveur manquante" });
        return;
  }

  if (!password || password !== process.env.PASSWORD) {
        res.status(401).json({ error: "Mot de passe incorrect" });
        return;
  }

  const expiry = Date.now() + SESSION_DURATION_SECONDS * 1000;
    const signature = await sign(process.env.APP_SESSION_SECRET, String(expiry));
    const token = `${expiry}.${signature}`;

  res.setHeader(
        "Set-Cookie",
        `bodacc_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION_SECONDS}`
      );
    res.status(200).json({ ok: true });
}
