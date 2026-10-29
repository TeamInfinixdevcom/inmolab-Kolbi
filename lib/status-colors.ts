export function statusBadgeClass(status: string): string {
  const value = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CR");

  if (value.includes("problema") || value.includes("atrasad")) {
    return "bg-[#f7e7de] text-[#8e4d32]";
  }
  if (value.includes("inactiv") || value.includes("cancel")) {
    return "bg-[#eff1ee] text-[#66736a]";
  }
  if (value.includes("pendiente") || value.includes("seguimiento")) {
    return "bg-[#f5efd9] text-[#735d1f]";
  }
  if (value.includes("activ") || value.includes("complet") || value.includes("progreso")) {
    return "bg-[#e7f1e6] text-[#315f49]";
  }
  return "bg-[#eff1ee] text-[#66736a]";
}
