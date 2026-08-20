// Middleware Vercel (Edge Runtime) : protège tout le site par mot de passe.
// Laisse passer /api/login (vérification) et /login.html (page de connexion)
// ainsi que les fichiers statiques, tout le reste exige un cookie de session valide.

export const config = {
    matcher: [
          "/((?!api/login|login\\.html|favicon\\.ico|.*\\.(?:css|js|mjs|svg|png|jpg|jpeg|webp|ico|woff2?)).*)",
        ],
};

async function verify(token, secret) {
    if (!token || !secret) return false;
    const [expiryStr, signature] = token.split(".");
    const expiry = Number(expiryStr);
    if (!expiry || Number.isNaN(expiry) || Date.now() > expiry) return false;

  const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(expiryStr));
    const expected = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return expected === signature;
}

export default async function middleware(request) {
    const cookie = request.cookies.get("bodacc_session");
    const valid = await verify(cookie?.value, process.env.APP_SESSION_SECRET);

  if (valid) return;

  const url = new URL("/login.html", request.url);
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return Response.redirect(url, 302);
}
