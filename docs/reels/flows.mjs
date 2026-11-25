// Guiones de interacción para cada clip (selectores de la app real).
export const FLOWS = {
  // ahorro en bóveda: crear "Casa propia" en CETES y abonarle
  boveda: { vaults: "usdc", steps: [
    { wait: 1500, mark: "home" },
    { tab: 2, wait: 2600, mark: "ahorro" },
    { click: "Nueva bóveda", wait: 1300, mark: "nueva" },
    { fill: ["input[placeholder^='Ej.']", "Casa propia"], wait: 600 },
    { sel: "button[aria-label='CETES']", wait: 1500, mark: "cetes" },
    { click: "Crear bóveda", wait: 2400, mark: "creada" },
    { click: "Casa propia", exact: true, wait: 2200, mark: "detalle" },
    { click: "Abonar", exact: true, wait: 1100, mark: "modal" },
    { type: "1000", wait: 800 },
    { sel: ".modal-sheet .btn-primary", wait: 3000, mark: "ok" },
    { click: "Listo", wait: 2600, mark: "listo" },
  ] },
  // abonar a una bóveda existente en CETES (la del viaje) y ver cómo rinde
  abonar: [
    { tab: 2, wait: 1800, mark: "ahorro" },
    { click: "Viaje a Japón", wait: 2600, mark: "detalle" },
    { click: "Abonar", exact: true, wait: 1200, mark: "modal" },
    { type: "500", wait: 900 },
    { sel: ".modal-sheet .btn-primary", wait: 2800, mark: "ok" },
    { click: "Listo", wait: 2500, mark: "listo" },
  ],
  // adelanto: ver la cotización cambiar con el plazo y pedirlo
  adelanto: [
    { tab: 3, wait: 2000, mark: "adelanto" },
    { scroll: 620, ms: 1100, wait: 900 },
    { click: "15 días", wait: 1100, mark: "p15" },
    { range: ["input[type=range]", 365, 2200], wait: 1500, mark: "p365" },
    { scroll: 360, ms: 800, wait: 600 },
    { click: "Pedir adelanto", wait: 3500, mark: "pedido" },
  ],
  // bonos en la wallet: CETES, TESOURO (Brasil) y USTRY (EE. UU.)
  wallet: [
    { wait: 1800, mark: "home" },
    { scroll: 820, ms: 1400, wait: 1800, mark: "lista" },
    { click: "TESOURO", exact: true, wait: 2600, mark: "tesouro" },
  ],
};
