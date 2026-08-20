export const getNextDrawTimeMillis = (fromTimeMillis = Date.now()) => {
  const date = new Date(fromTimeMillis);
  let year = date.getFullYear();
  let month = date.getMonth(); // 0-indexed (0=Jan, 9=Oct, 11=Dec)
  const day = date.getDate();
  const hours = date.getHours();

  const firstSeasonStartYear = 2026;
  const activeMonths = [9, 10, 11, 0, 1, 2, 3, 4, 5]; // Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun

  let targetYear = year < firstSeasonStartYear ? firstSeasonStartYear : year;
  let targetMonth = month;

  const targetDayThisMonth = targetMonth === 1 ? 28 : 30; // 28th for Feb, 30th for others
  const passedThisMonth = day > targetDayThisMonth || (day === targetDayThisMonth && hours >= 20);

  if (passedThisMonth) {
    targetMonth++;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }
  }

  while (!activeMonths.includes(targetMonth) || targetYear < firstSeasonStartYear) {
    targetMonth++;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }
  }

  const targetDay = targetMonth === 1 ? 28 : 30;
  const targetDate = new Date(targetYear, targetMonth, targetDay, 20, 0, 0, 0);
  return targetDate.getTime();
};
