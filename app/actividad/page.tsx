import { redirect } from "next/navigation";

export default function ActividadLegacyRoute() {
  redirect("/agenda?vista=actividad");
}
