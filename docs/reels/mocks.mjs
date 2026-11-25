// Respuestas de ejemplo para grabar la app en modo demo (nada sale a la red real).
export const PK = "GBXD6HFNTTXDDZRCSDXDKZYEPHAUYT3UPNYHYCMSXEFQ5IAHNSCDBI5G";
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
export const FIX = [];
export async function installMocks(ctx) {
  await ctx.route(/horizon.*stellar\.org|soroban|stellar-rpc|rpc\..*stellar/, (r) => {
    const u = r.request().url();
    const hit = FIX.find((f) => f.horizon && f.horizon.test(u));
    return hit ? json(r, hit.body(u)) : json(r, { _embedded: { records: [] } });
  });
  await ctx.route("**/api/**", (r) => {
    const u = new URL(r.request().url());
    const hit = FIX.find((f) => f.api && f.api.test(u.pathname));
    if (hit) return json(r, hit.body(u, r.request()));
    // nada de escrituras reales desde la grabación
    if (r.request().method() !== "GET") return json(r, { ok: true, success: true, xdr: "AAAA", signedXdr: "AAAA", txHash: "7f3c9a1e".repeat(8), hash: "7f3c9a1e".repeat(8) });
    return r.continue();
  });
}
