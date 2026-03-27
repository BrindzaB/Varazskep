import type { Metadata } from "next";
import DesignerLayout from "@/components/designer/DesignerLayout";

export const metadata: Metadata = {
  title: "Tervező – Varázskép",
  description: "Tervezd meg egyedi pólódat a Varázskép online tervezőjével.",
};

export default function DesignerPage() {
  return <DesignerLayout />;
}
