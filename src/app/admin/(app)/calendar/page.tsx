import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { getAdminCalendar } from "@/server/services/calendar-service";
import {
  CalendarResourceTimeline,
  type CalendarViewSpan,
} from "@/components/admin/calendar-resource-timeline";
import {
  addDays,
  DATE_ONLY_REGEX,
  formatDateOnly,
  getPropertyTodayString,
  parseDateOnly,
} from "@/lib/dates";

interface AdminCalendarPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function pickParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const val = params[key];
  const str = Array.isArray(val) ? val[0] : val;
  const trimmed = str?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export default async function AdminCalendarPage({ searchParams }: AdminCalendarPageProps) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const rawParams = searchParams ? await searchParams : {};

  const todayString = getPropertyTodayString();

  const rawSpan = pickParam(rawParams, "span");
  const span: CalendarViewSpan = rawSpan === "week" || rawSpan === "month" ? rawSpan : "twoWeeks";

  const rawStart = pickParam(rawParams, "start");
  let startString = todayString;
  if (rawStart && DATE_ONLY_REGEX.test(rawStart)) {
    try {
      parseDateOnly(rawStart);
      startString = rawStart;
    } catch {
      startString = todayString;
    }
  }

  const daysCount = span === "week" ? 7 : span === "month" ? 30 : 14;
  const endString = formatDateOnly(addDays(parseDateOnly(startString), daysCount));

  const calendarData = await getAdminCalendar(db, {
    from: startString,
    to: endString,
    unitIds: pickParam(rawParams, "unitIds"),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold text-gray-800">
          {messages.admin.sections.calendarTitle}
        </h1>
        <p className="max-w-2xl font-sans text-sm text-gray-600">
          {messages.admin.sections.calendarSubtitle}
        </p>
      </header>

      <CalendarResourceTimeline
        locale={locale}
        messages={messages}
        calendarData={calendarData}
        todayString={todayString}
        currentSpan={span}
        startDateString={startString}
      />
    </div>
  );
}
