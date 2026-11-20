/**
 * Philippine National Holidays Definition & Calculator
 * Covers Official Regular Holidays and Special (Non-Working) Days
 * as proclaimed under Philippine Presidential Proclamations, RA 9492, and the Labor Code.
 */

export interface PhilippineHoliday {
  id: string;
  title: string;
  eventType: "Holiday";
  eventDate: string; // ISO string e.g. "2026-06-12T00:00:00.000Z"
  eventTime: null;
  notes: string; // JSON metadata
  prId: null;
  isHoliday: boolean;
  holidayType: "Regular Holiday" | "Special (Non-Working) Day";
}

/**
 * Calculates Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 */
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed month (2 = March, 3 = April)
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Calculates the last Monday of August (National Heroes Day).
 */
function getLastMondayOfAugust(year: number): Date {
  const date = new Date(year, 7, 31, 12, 0, 0); // August 31
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = (dayOfWeek + 6) % 7;
  date.setDate(31 - diff);
  return date;
}

/**
 * Official Philippine Proclamation dates for movable Islamic / Lunar holidays (2024 - 2030).
 */
const MOVABLE_HOLIDAYS_TABLE: Record<
  number,
  {
    chineseNewYear?: { month: number; day: number };
    eidlFitr?: { month: number; day: number };
    eidlAdha?: { month: number; day: number };
  }
> = {
  2024: {
    chineseNewYear: { month: 1, day: 10 }, // Feb 10
    eidlFitr: { month: 3, day: 10 }, // Apr 10
    eidlAdha: { month: 5, day: 17 }, // Jun 17
  },
  2025: {
    chineseNewYear: { month: 0, day: 29 }, // Jan 29
    eidlFitr: { month: 2, day: 31 }, // Mar 31
    eidlAdha: { month: 5, day: 6 }, // Jun 6
  },
  2026: {
    chineseNewYear: { month: 1, day: 17 }, // Feb 17
    eidlFitr: { month: 2, day: 20 }, // Mar 20
    eidlAdha: { month: 4, day: 27 }, // May 27
  },
  2027: {
    chineseNewYear: { month: 1, day: 6 }, // Feb 6
    eidlFitr: { month: 2, day: 10 }, // Mar 10
    eidlAdha: { month: 4, day: 17 }, // May 17
  },
  2028: {
    chineseNewYear: { month: 0, day: 26 }, // Jan 26
    eidlFitr: { month: 1, day: 28 }, // Feb 28
    eidlAdha: { month: 4, day: 5 }, // May 5
  },
  2029: {
    chineseNewYear: { month: 1, day: 13 }, // Feb 13
    eidlFitr: { month: 1, day: 15 }, // Feb 15
    eidlAdha: { month: 3, day: 24 }, // Apr 24
  },
  2030: {
    chineseNewYear: { month: 1, day: 3 }, // Feb 3
    eidlFitr: { month: 1, day: 5 }, // Feb 5
    eidlAdha: { month: 3, day: 14 }, // Apr 14
  },
};

/**
 * Returns all official Philippine national holidays for the specified calendar year.
 */
export function getPhilippineHolidays(year: number): PhilippineHoliday[] {
  const holidays: PhilippineHoliday[] = [];

  const createHoliday = (
    slug: string,
    title: string,
    date: Date,
    type: "Regular Holiday" | "Special (Non-Working) Day",
    description?: string
  ): PhilippineHoliday => {
    // Normalise to midday UTC to avoid local timezone offset shifting the date
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
    return {
      id: `ph-holiday-${year}-${slug}`,
      title,
      eventType: "Holiday",
      eventDate: d.toISOString(),
      eventTime: null,
      prId: null,
      isHoliday: true,
      holidayType: type,
      notes: JSON.stringify({
        description: description || `Official Philippine ${type}`,
        venue: "Nationwide",
        holidayType: type,
        isHoliday: true,
      }),
    };
  };

  // ─── 1. FIXED REGULAR HOLIDAYS ───
  holidays.push(
    createHoliday("new-years-day", "New Year's Day (Araw ng Bagong Taon)", new Date(year, 0, 1), "Regular Holiday"),
    createHoliday("day-of-valor", "Araw ng Kagitingan (Day of Valor)", new Date(year, 3, 9), "Regular Holiday"),
    createHoliday("labor-day", "Labor Day (Araw ng Paggawa)", new Date(year, 4, 1), "Regular Holiday"),
    createHoliday("independence-day", "Independence Day (Araw ng Kalayaan)", new Date(year, 5, 12), "Regular Holiday"),
    createHoliday("national-heroes-day", "National Heroes Day (Araw ng mga Bayani)", getLastMondayOfAugust(year), "Regular Holiday", "Celebrated every last Monday of August"),
    createHoliday("bonifacio-day", "Bonifacio Day (Araw ni Bonifacio)", new Date(year, 10, 30), "Regular Holiday"),
    createHoliday("christmas-day", "Christmas Day (Araw ng Pasko)", new Date(year, 11, 25), "Regular Holiday"),
    createHoliday("rizal-day", "Rizal Day (Araw ng Kabayanihan ni Dr. Jose Rizal)", new Date(year, 11, 30), "Regular Holiday")
  );

  // ─── 2. FIXED SPECIAL (NON-WORKING) DAYS ───
  holidays.push(
    createHoliday("edsa-revolution", "EDSA People Power Revolution Anniversary", new Date(year, 1, 25), "Special (Non-Working) Day"),
    createHoliday("ninoy-aquino-day", "Ninoy Aquino Day", new Date(year, 7, 21), "Special (Non-Working) Day"),
    createHoliday("all-saints-day", "All Saints' Day (Todos Los Santos)", new Date(year, 10, 1), "Special (Non-Working) Day"),
    createHoliday("all-souls-day", "All Souls' Day", new Date(year, 10, 2), "Special (Non-Working) Day"),
    createHoliday("immaculate-conception", "Feast of the Immaculate Conception of Mary", new Date(year, 11, 8), "Special (Non-Working) Day"),
    createHoliday("christmas-eve", "Christmas Eve", new Date(year, 11, 24), "Special (Non-Working) Day"),
    createHoliday("new-years-eve", "Last Day of the Year (New Year's Eve)", new Date(year, 11, 31), "Special (Non-Working) Day")
  );

  // ─── 3. MOVABLE HOLY WEEK (EASTER-BASED) ───
  const easter = getEasterSunday(year);
  const easterDate = new Date(year, easter.month, easter.day);

  const maundyThursday = new Date(easterDate);
  maundyThursday.setDate(easterDate.getDate() - 3);

  const goodFriday = new Date(easterDate);
  goodFriday.setDate(easterDate.getDate() - 2);

  const blackSaturday = new Date(easterDate);
  blackSaturday.setDate(easterDate.getDate() - 1);

  holidays.push(
    createHoliday("maundy-thursday", "Maundy Thursday (Huwebes Santo)", maundyThursday, "Regular Holiday", "Holy Week Regular Holiday"),
    createHoliday("good-friday", "Good Friday (Biyernes Santo)", goodFriday, "Regular Holiday", "Holy Week Regular Holiday"),
    createHoliday("black-saturday", "Black Saturday (Sabado de Gloria)", blackSaturday, "Special (Non-Working) Day", "Holy Week Special Non-Working Day")
  );

  // ─── 4. MOVABLE ISLAMIC & LUNAR HOLIDAYS ───
  const movable = MOVABLE_HOLIDAYS_TABLE[year];
  if (movable) {
    if (movable.chineseNewYear) {
      holidays.push(
        createHoliday(
          "chinese-new-year",
          "Chinese New Year",
          new Date(year, movable.chineseNewYear.month, movable.chineseNewYear.day),
          "Special (Non-Working) Day"
        )
      );
    }
    if (movable.eidlFitr) {
      holidays.push(
        createHoliday(
          "eidl-fitr",
          "Eid'l Fitr (Feast of Ramadhan)",
          new Date(year, movable.eidlFitr.month, movable.eidlFitr.day),
          "Regular Holiday"
        )
      );
    }
    if (movable.eidlAdha) {
      holidays.push(
        createHoliday(
          "eidl-adha",
          "Eid'l Adha (Feast of Sacrifice)",
          new Date(year, movable.eidlAdha.month, movable.eidlAdha.day),
          "Regular Holiday"
        )
      );
    }
  }

  // Sort chronologically
  return holidays.sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );
}

/**
 * Returns all Philippine holidays falling within the given date range.
 */
export function getPhilippineHolidaysForRange(startDate: Date, endDate: Date): PhilippineHoliday[] {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  const allHolidays: PhilippineHoliday[] = [];
  for (let y = startYear; y <= endYear; y++) {
    allHolidays.push(...getPhilippineHolidays(y));
  }

  const startMs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0).getTime();
  const endMs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime();

  return allHolidays.filter((h) => {
    const hTime = new Date(h.eventDate).getTime();
    return hTime >= startMs && hTime <= endMs;
  });
}
