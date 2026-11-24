export type RequestKind = "additional" | "substitution" | "removal";

/**
 * Un cambio de un día de teletrabajo.
 * - `from`: día que deja de ser teletrabajo (se pinta en naranja).
 * - `to`: día que pasa a ser teletrabajo (se pinta en verde).
 * Fechas en formato YYYY-MM-DD.
 */
export interface DateChange {
  from: string | null;
  to: string | null;
}

export interface WfhChange {
  requestId: string;
  kind: RequestKind;
  comment: string | null;
  changes: DateChange[];
}
