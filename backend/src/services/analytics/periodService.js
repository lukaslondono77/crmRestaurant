/**
 * Defines and manages reporting periods for restaurant analytics.
 * Aligns with operational cycles: weekly, biweekly, monthly, quarterly.
 */

const { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, differenceInDays } = require('date-fns');

const STANDARD_PERIODS = {
  WEEKLY: 'week',
  BIWEEKLY: 'biweek',
  MONTHLY: 'month',
  QUARTERLY: 'quarter'
};

/**
 * Get current period boundaries and label.
 * @param {string} type - 'weekly' | 'monthly' | 'biweek' | 'quarter'
 * @param {number} startDay - 0 = Sunday, 1 = Monday (week start for weekly)
 * @returns {{ startDate: string, endDate: string, label: string, dayCount: number }}
 */
function getCurrentPeriod(type = 'weekly', startDay = 0) {
  const now = new Date();
  const options = { weekStartsOn: startDay };

  let startDate;
  let endDate;
  let label;

  switch (String(type).toLowerCase()) {
    case 'week':
    case 'weekly': {
      startDate = startOfWeek(now, options);
      endDate = endOfWeek(now, options);
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const dayCount = differenceInDays(endDate, startDate) + 1;
      label = dayCount >= 7 ? `This Week (${format(startDate, 'MMM d')}–${format(endDate, 'MMM d, yyyy')})` : `${startStr} to ${endStr}`;
      return {
        startDate: startStr,
        endDate: endStr,
        label,
        dayCount
      };
    }
    case 'biweek':
    case 'biweekly': {
      startDate = startOfWeek(now, options);
      const week2 = new Date(startDate);
      week2.setDate(week2.getDate() + 13);
      endDate = endOfWeek(week2, options);
      if (endDate > now) endDate = now;
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const dayCount = differenceInDays(endDate, startDate) + 1;
      label = `Biweekly (${format(startDate, 'MMM d')}–${format(endDate, 'MMM d, yyyy')})`;
      return { startDate: startStr, endDate: endStr, label, dayCount };
    }
    case 'month':
    case 'monthly': {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const dayCount = differenceInDays(endDate, startDate) + 1;
      label = `${format(now, 'MMMM yyyy')} (${dayCount} days)`;
      return { startDate: startStr, endDate: endStr, label, dayCount };
    }
    case 'quarter':
    case 'quarterly': {
      startDate = startOfQuarter(now);
      endDate = endOfQuarter(now);
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const dayCount = differenceInDays(endDate, startDate) + 1;
      const q = Math.floor(now.getMonth() / 3) + 1;
      label = `Q${q} ${now.getFullYear()} (${format(startDate, 'MMM d')}–${format(endDate, 'MMM d')})`;
      return { startDate: startStr, endDate: endStr, label, dayCount };
    }
    default:
      return getCurrentPeriod('weekly', startDay);
  }
}

/**
 * Get previous period of the same type (e.g. last week, last month).
 */
function getPreviousPeriod(type = 'weekly', startDay = 0) {
  const now = new Date();
  const options = { weekStartsOn: startDay };

  let startDate;
  let endDate;

  switch (String(type).toLowerCase()) {
    case 'week':
    case 'weekly': {
      const thisWeekStart = startOfWeek(now, options);
      startDate = new Date(thisWeekStart);
      startDate.setDate(startDate.getDate() - 7);
      endDate = endOfWeek(startDate, options);
      break;
    }
    case 'month':
    case 'monthly': {
      const thisMonth = startOfMonth(now);
      startDate = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
      endDate = endOfMonth(startDate);
      break;
    }
    default: {
      const current = getCurrentPeriod(type, startDay);
      return { startDate: current.startDate, endDate: current.endDate, label: `Previous ${type}`, dayCount: current.dayCount };
    }
  }

  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');
  const dayCount = differenceInDays(endDate, startDate) + 1;
  return { startDate: startStr, endDate: endStr, label: `Previous ${type}`, dayCount };
}

module.exports = {
  STANDARD_PERIODS,
  getCurrentPeriod,
  getPreviousPeriod
};
