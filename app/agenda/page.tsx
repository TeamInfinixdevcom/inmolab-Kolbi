import { AgendaWorkspace } from "@/components/agenda/agenda-workspace";

type AgendaView = "tareas" | "eventos" | "actividad";

export default async function AgendaPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ vista?: string }>;
}>) {
  const { vista } = await searchParams;
  const initialView: AgendaView = vista === "eventos" || vista === "actividad" ? vista : "tareas";
  return <AgendaWorkspace initialView={initialView} />;
}
