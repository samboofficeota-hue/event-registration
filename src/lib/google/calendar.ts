import { getAccessToken } from "./auth";
import { v4 as uuidv4 } from "uuid";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

function getCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

export interface CalendarEventResult {
  eventId: string;
  meetUrl: string;
}

export async function createCalendarEvent(
  title: string,
  startDateTime: string,
  durationMinutes: number,
  description?: string
): Promise<CalendarEventResult> {
  const token = await getAccessToken();
  const calendarId = getCalendarId();

  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        description: description || "",
        start: {
          dateTime: start.toISOString(),
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "Asia/Tokyo",
        },
        conferenceData: {
          createRequest: {
            conferenceSolutionKey: { type: "hangoutsMeet" },
            requestId: uuidv4(),
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create calendar event: ${error}`);
  }

  const data = await response.json();
  const meetUrl =
    data.conferenceData?.entryPoints?.find(
      (ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video"
    )?.uri || "";

  return {
    eventId: data.id,
    meetUrl,
  };
}

export async function updateCalendarEvent(
  eventId: string,
  title: string,
  startDateTime: string,
  durationMinutes: number,
  description?: string
): Promise<void> {
  const token = await getAccessToken();
  const calendarId = getCalendarId();

  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        description: description || "",
        start: {
          dateTime: start.toISOString(),
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "Asia/Tokyo",
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update calendar event: ${error}`);
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const token = await getAccessToken();
  const calendarId = getCalendarId();

  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok && response.status !== 410) {
    const error = await response.text();
    throw new Error(`Failed to delete calendar event: ${error}`);
  }
}
