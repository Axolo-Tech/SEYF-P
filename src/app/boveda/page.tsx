import type { Metadata } from "next";
import BovedaClaim from "@/components/boveda/BovedaClaim";

export const metadata: Metadata = {
  title: "SEYF — Bóveda Ship It (testnet)",
  description: "Reclama los XLM de testnet guardados en la bóveda de SEYF con el código correcto.",
};

export default function BovedaPage() {
  return <BovedaClaim />;
}
