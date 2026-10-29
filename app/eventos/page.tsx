import { redirect } from "next/navigation";

export default function EventosLegacyRoute() {
  redirect("/agenda?vista=eventos");
}
