package com.ntvelop.mprikiwinners.domain.util

import java.util.Calendar
import java.util.TimeZone

object MonthlyDrawSchedule {

    /**
     * Active draw months: October (9), November (10), December (11), January (0), 
     * February (1), March (2), April (3), May (4), June (5). (0-indexed in Calendar)
     */
    private val ACTIVE_SEASON_MONTHS = listOf(
        Calendar.OCTOBER,
        Calendar.NOVEMBER,
        Calendar.DECEMBER,
        Calendar.JANUARY,
        Calendar.FEBRUARY,
        Calendar.MARCH,
        Calendar.APRIL,
        Calendar.MAY,
        Calendar.JUNE
    )

    /**
     * Calculates the next draw timestamp on the 30th of each month (and 28th for February) at 20:00 (8 PM).
     * Season starts October 30, 2026 and runs every month until June 2027, 
     * repeating every October-June season.
     */
    fun getNextDrawTimeMillis(fromTimeMillis: Long = System.currentTimeMillis()): Long {
        val cal = Calendar.getInstance(TimeZone.getDefault()).apply {
            timeInMillis = fromTimeMillis
        }

        val year = cal.get(Calendar.YEAR)
        val month = cal.get(Calendar.MONTH)
        val day = cal.get(Calendar.DAY_OF_MONTH)

        // Check target dates starting from 30 Oct 2026
        val firstSeasonStartYear = 2026

        var targetYear = if (year < firstSeasonStartYear) firstSeasonStartYear else year
        var targetMonth = month

        val drawDayThisMonth = if (targetMonth == Calendar.FEBRUARY) 28 else 30
        val passedThisMonthDraw = day > drawDayThisMonth || (day == drawDayThisMonth && cal.get(Calendar.HOUR_OF_DAY) >= 20)

        if (passedThisMonthDraw) {
            targetMonth++
            if (targetMonth > Calendar.DECEMBER) {
                targetMonth = Calendar.JANUARY
                targetYear++
            }
        }

        // Find the next active month in the Oct-Jun season
        while (!ACTIVE_SEASON_MONTHS.contains(targetMonth) || targetYear < firstSeasonStartYear) {
            targetMonth++
            if (targetMonth > Calendar.DECEMBER) {
                targetMonth = Calendar.JANUARY
                targetYear++
            }
        }

        // Build target calendar date (28th for February, 30th for other months at 20:00)
        val targetCal = Calendar.getInstance(TimeZone.getDefault()).apply {
            clear()
            set(Calendar.YEAR, targetYear)
            set(Calendar.MONTH, targetMonth)
            
            val targetDay = if (targetMonth == Calendar.FEBRUARY) 28 else 30

            set(Calendar.DAY_OF_MONTH, targetDay)
            set(Calendar.HOUR_OF_DAY, 20)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        return targetCal.timeInMillis
    }
}
