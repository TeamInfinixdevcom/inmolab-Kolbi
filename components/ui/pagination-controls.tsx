import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  itemCount: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  pageCount,
  pageSize,
  itemCount,
  onPageChange,
}: Readonly<PaginationControlsProps>) {
  const firstItem = itemCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, itemCount);

  return (
    <nav aria-label="Paginación de resultados" className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <p className="text-xs text-muted-foreground">
        Mostrando {firstItem}–{lastItem} de {itemCount}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft size={15} className="mr-1" /> Anterior
          </Button>
          <span className="min-w-20 text-center text-xs text-muted-foreground" aria-live="polite">
            Página {page} de {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Página siguiente"
          >
            Siguiente <ChevronRight size={15} className="ml-1" />
          </Button>
        </div>
      )}
    </nav>
  );
}
