import { getCloudflareContext } from "@opennextjs/cloudflare";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type D1Database = any;

/**
 * Cloudflare D1 バインディングを取得する。
 * Next.js API ルート（async コンテキスト）から呼び出す。
 */
export async function getD1(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as Record<string, unknown>).DB as D1Database;
  if (!db) {
    throw new Error("D1 database binding 'DB' is not available");
  }
  return db;
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSchedule {
  id: number;
  seminar_id: string;
  template_id: string;
  scheduled_date: string;
  send_time: string;
  enabled: number; // 1 = ON, 0 = OFF
  status: "pending" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  list_id: string | null; // 告知集客用スケジュールの送付リストID
  created_at: string;
  updated_at: string;
}

export interface EmailSendLog {
  id: number;
  schedule_id: number;
  seminar_id: string;
  recipient_email: string;
  recipient_name: string | null;
  status: "sent" | "failed";
  resend_id: string | null;
  error_message: string | null;
  sent_at: string;
}

// ---------------------------------------------------------------------------
// seminars / registrations 型定義
// ---------------------------------------------------------------------------

export interface D1Seminar {
  id: string;
  tenant: string;
  title: string;
  description: string;
  date: string;
  end_time: string;
  capacity: number;
  current_bookings: number;
  speaker: string;
  speaker_title: string;
  speaker_reference_url: string;
  format: string;
  target: string;
  invitation_code: string;
  image_url: string;
  meet_url: string;
  calendar_event_id: string;
  status: string;
  spreadsheet_id: string;
  created_at: string;
  updated_at: string;
}

export interface D1Registration {
  id: string;
  seminar_id: string;
  tenant: string;
  reservation_number: string;
  name: string;
  email: string;
  company: string;
  department: string;
  phone: string;
  status: string;
  participation_method: string;
  pre_survey_completed: number;
  post_survey_completed: number;
  note: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// D1 ヘルパー: seminars
// ---------------------------------------------------------------------------

export async function getSeminarByIdFromD1(id: string): Promise<D1Seminar | null> {
  const db = await getD1();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.prepare("SELECT * FROM seminars WHERE id = ?").bind(id).first() as any;
  return (result ?? null) as D1Seminar | null;
}

export async function getSeminarsByTenantFromD1(
  tenant: string,
  statusFilter?: string
): Promise<D1Seminar[]> {
  const db = await getD1();
  let query = "SELECT * FROM seminars WHERE tenant = ?";
  const binds: unknown[] = [tenant];
  if (statusFilter) {
    query += " AND status = ?";
    binds.push(statusFilter);
  }
  query += " ORDER BY date DESC";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.prepare(query).bind(...binds).all() as any;
  return (result.results ?? []) as D1Seminar[];
}

export async function insertSeminarToD1(seminar: D1Seminar): Promise<void> {
  const db = await getD1();
  await db.prepare(`
    INSERT INTO seminars (
      id, tenant, title, description, date, end_time,
      capacity, current_bookings, speaker, speaker_title,
      speaker_reference_url, format, target, invitation_code,
      image_url, meet_url, calendar_event_id, status,
      spreadsheet_id, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    seminar.id, seminar.tenant, seminar.title, seminar.description,
    seminar.date, seminar.end_time, seminar.capacity, seminar.current_bookings,
    seminar.speaker, seminar.speaker_title, seminar.speaker_reference_url,
    seminar.format, seminar.target, seminar.invitation_code,
    seminar.image_url, seminar.meet_url, seminar.calendar_event_id,
    seminar.status, seminar.spreadsheet_id, seminar.created_at, seminar.updated_at
  ).run();
}

export async function updateSeminarInD1(id: string, updates: Partial<D1Seminar>): Promise<void> {
  const db = await getD1();
  const fields = Object.keys(updates).filter((k) => k !== "id");
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (updates as Record<string, unknown>)[f]);
  await db.prepare(`UPDATE seminars SET ${setClause} WHERE id = ?`)
    .bind(...values, id).run();
}

// ---------------------------------------------------------------------------
// D1 ヘルパー: registrations
// ---------------------------------------------------------------------------

export async function getRegistrationsBySeminarFromD1(seminarId: string): Promise<D1Registration[]> {
  const db = await getD1();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.prepare(
    "SELECT * FROM registrations WHERE seminar_id = ? ORDER BY created_at ASC"
  ).bind(seminarId).all() as any;
  return (result.results ?? []) as D1Registration[];
}

export async function getRegistrationByIdFromD1(id: string): Promise<D1Registration | null> {
  const db = await getD1();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.prepare("SELECT * FROM registrations WHERE id = ?").bind(id).first() as any;
  return (result ?? null) as D1Registration | null;
}

export async function getRegistrationByNumberFromD1(
  reservationNumber: string
): Promise<D1Registration | null> {
  const db = await getD1();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.prepare(
    "SELECT * FROM registrations WHERE reservation_number = ?"
  ).bind(reservationNumber).first() as any;
  return (result ?? null) as D1Registration | null;
}

export async function insertRegistrationToD1(reg: D1Registration): Promise<void> {
  const db = await getD1();
  await db.prepare(`
    INSERT INTO registrations (
      id, seminar_id, tenant, reservation_number,
      name, email, company, department, phone,
      status, participation_method,
      pre_survey_completed, post_survey_completed,
      note, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    reg.id, reg.seminar_id, reg.tenant, reg.reservation_number,
    reg.name, reg.email, reg.company, reg.department, reg.phone,
    reg.status, reg.participation_method,
    reg.pre_survey_completed, reg.post_survey_completed,
    reg.note, reg.created_at
  ).run();
}

export async function updateRegistrationInD1(
  id: string,
  updates: Partial<D1Registration>
): Promise<void> {
  const db = await getD1();
  const fields = Object.keys(updates).filter((k) => k !== "id");
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (updates as Record<string, unknown>)[f]);
  await db.prepare(`UPDATE registrations SET ${setClause} WHERE id = ?`)
    .bind(...values, id).run();
}
