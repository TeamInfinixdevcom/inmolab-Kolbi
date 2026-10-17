import { redirect } from "next/navigation";

export default function ClientesLegacyRoute() {
  redirect("/agenda?vista=eventos");
}
