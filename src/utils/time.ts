/** biome-ignore-all lint/suspicious/noShadowRestrictedNames: Local function namespace */

import { Temporal } from "temporal-polyfill";

/**
 * Get ZonedDateTime in specified timezone
 * @param time ISO string or Date object
 * @param userTimezone Whether to use user's local timezone
 * @returns ZonedDateTime object
 */
export function getZonedDateTime(time?: string | Date, userTimezone: boolean = false) {
	if (time instanceof Date) time = time.toISOString();

	const instant = time ? Temporal.Instant.from(time) : Temporal.Now.instant();
	const timezone = userTimezone ? Temporal.Now.timeZoneId() : import.meta.env.PUBLIC_TIMEZONE || "UTC";

	return instant.toZonedDateTimeISO(timezone);
}

/**
 * Time utility functions
 */
const Time = {
	/**
	 * Format date-time as "YYYY/MM/DD-HH:MM:SS"
	 * @param time ISO string or Date object
	 * @param userTimezone Whether to use user's local timezone
	 * @returns Formatted date-time string
	 */
	toString(time?: string | Date, userTimezone: boolean = false): string {
		const datetime = getZonedDateTime(time, userTimezone);
		const formatted = datetime.toString().slice(0, 19);
		return formatted.replace(/-/g, "/").replace("T", "-");
	},

	/**
	 * Format date-time in localized format based on user's locale
	 * @param time ISO string or Date object
	 * @param locale Locale string, defaults to browser's language setting
	 * @param userTimezone Whether to use user's local timezone
	 * @returns Localized date-time string
	 */
	toLocaleString(time?: string | Date, locale: string = navigator.language, userTimezone: boolean = false): string {
		const datetime = getZonedDateTime(time, userTimezone);
		return datetime.toLocaleString(locale, { dateStyle: "medium", timeStyle: "medium" });
	},

	/**
	 * Format date as "YYYY/MM/DD"
	 * @param time ISO string or Date object
	 * @param userTimezone Whether to use user's local timezone
	 * @returns Formatted date string
	 */
	toDateString(time?: string | Date, userTimezone: boolean = false): string {
		const date = getZonedDateTime(time, userTimezone).toPlainDate();
		return date.toString().replace(/-/g, "/");
	},

	/**
	 * Format date in localized format based on user's locale
	 * @param time ISO string or Date object
	 * @param locale Locale string, defaults to browser's language setting
	 * @param userTimezone Whether to use user's local timezone
	 * @returns Localized date string
	 */
	toLocaleDateString(time?: string | Date, locale: string = navigator.language, userTimezone: boolean = false): string {
		const date = getZonedDateTime(time, userTimezone).toPlainDate();
		return date.toLocaleString(locale, { year: "numeric", month: "short", day: "numeric" });
	}
};

export default Time;
