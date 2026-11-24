import type { Sql } from "./client.js";
import type { DateChange, RequestKind, WfhChange } from "../watcher/types.js";

interface RequestRow {
  id: string;
  kind: RequestKind;
  comment: string | null;
}

interface DateRow {
  request_id: string;
  requested_date: string;
  replaced_date: string | null;
}

export interface TargetUser {
  userId?: string;
  oracleEmpId?: number;
}

export async function resolveTargetUserId(sql: Sql, target: TargetUser): Promise<string> {
  const rows = target.userId
    ? await sql<{ id: string }[]>`select id from users where id = ${target.userId}`
    : await sql<{ id: string }[]>`select id from users where oracle_emp_id = ${target.oracleEmpId ?? null}`;
  if (rows.length === 0) {
    throw new Error("No se encontró en la base de datos al usuario a vigilar (revisa TARGET_USER_ID / TARGET_ORACLE_EMP_ID).");
  }
  return rows[0].id;
}

/**
 * Hora actual de la base de datos (menos un margen), como texto con
 * microsegundos para no perder precisión al compararla después.
 */
export async function getDbNow(sql: Sql, marginSeconds: number): Promise<string> {
  const [row] = await sql<{ now: string }[]>`
    select to_char(
      (clock_timestamp() - make_interval(secs => ${marginSeconds}::double precision)) at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ) as now`;
  return row.now;
}

/**
 * Solicitudes ACEPTADAS del usuario tocadas desde `since`. Las sustituciones y
 * anulaciones se aceptan al crearlas; las adicionales, cuando alguien las aprueba
 * (un trigger de la BD actualiza `updated_at` en ambos casos).
 */
export async function findAcceptedChangesSince(sql: Sql, userId: string, since: string): Promise<WfhChange[]> {
  const requests = await sql<RequestRow[]>`
    select id, kind, requester_comment as comment
    from wfh_change_requests
    where requester_id = ${userId}
      and status = 'accepted'
      and updated_at > ${since}::timestamptz
    order by updated_at asc`;
  if (requests.length === 0) return [];

  const dates = await sql<DateRow[]>`
    select request_id, requested_date::text as requested_date, replaced_date::text as replaced_date
    from wfh_change_request_dates
    where request_id in ${sql(requests.map((request) => request.id))}
      and cancelled_at is null
    order by requested_date asc`;

  return requests.map((request) => ({
    requestId: request.id,
    kind: request.kind,
    comment: request.comment?.trim() || null,
    changes: dates
      .filter((date) => date.request_id === request.id)
      .map((date): DateChange => {
        if (request.kind === "substitution") return { from: date.replaced_date, to: date.requested_date };
        if (request.kind === "removal") return { from: date.requested_date, to: null };
        return { from: null, to: date.requested_date };
      }),
  }));
}
