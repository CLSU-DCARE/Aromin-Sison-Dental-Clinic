<?php

namespace ASDC;

class HolidayCalendar
{
    private const CHINESE_NEW_YEAR = [
        2026 => '2026-02-17',
        2027 => '2027-02-06',
        2028 => '2028-01-26',
        2029 => '2029-02-13',
        2030 => '2030-02-03',
        2031 => '2031-01-23',
        2032 => '2032-02-11',
        2033 => '2033-01-31',
        2034 => '2034-02-19',
        2035 => '2035-02-08',
        2036 => '2036-01-28',
        2037 => '2037-02-15',
    ];

    public static function closureForDate(string $date): ?array
    {
        $dt = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$dt || $dt->format('Y-m-d') !== $date) {
            return null;
        }

        if ($dt->format('w') === '0') {
            return ['name' => 'Sunday', 'type' => 'weekly_closure'];
        }

        $holidays = self::holidaysForYear((int) $dt->format('Y'));
        if (!isset($holidays[$date])) {
            return null;
        }
        return ['name' => $holidays[$date], 'type' => 'holiday'];
    }

    public static function closedMessage(string $date): ?string
    {
        $closure = self::closureForDate($date);
        return $closure
            ? 'Sorry, we are closed for ' . $closure['name'] . '. Please choose another date.'
            : null;
    }

    private static function holidaysForYear(int $year): array
    {
        $easter = self::easterDate($year);
        $maundyThursday = $easter->modify('-3 days')->format('Y-m-d');
        $goodFriday = $easter->modify('-2 days')->format('Y-m-d');

        $holidays = [
            sprintf('%04d-01-01', $year) => "New Year's Day",
            $maundyThursday => 'Maundy Thursday',
            $goodFriday => 'Good Friday',
            sprintf('%04d-04-09', $year) => 'Araw ng Kagitingan',
            sprintf('%04d-05-01', $year) => 'Labor Day',
            sprintf('%04d-06-12', $year) => 'Independence Day',
            self::lastMondayOfAugust($year) => 'National Heroes Day',
            sprintf('%04d-08-21', $year) => 'Ninoy Aquino Day',
            sprintf('%04d-11-01', $year) => "All Saints' Day",
            sprintf('%04d-11-30', $year) => 'Bonifacio Day',
            sprintf('%04d-12-25', $year) => 'Christmas Day',
            sprintf('%04d-12-30', $year) => 'Rizal Day',
            sprintf('%04d-12-31', $year) => "New Year's Eve",
        ];

        if (isset(self::CHINESE_NEW_YEAR[$year])) {
            $holidays[self::CHINESE_NEW_YEAR[$year]] = 'Chinese New Year';
        }

        return $holidays;
    }

    private static function easterDate(int $year): \DateTimeImmutable
    {
        return (new \DateTimeImmutable(sprintf('%04d-03-21', $year)))
            ->modify('+' . easter_days($year) . ' days');
    }

    private static function lastMondayOfAugust(int $year): string
    {
        $date = new \DateTimeImmutable(sprintf('%04d-08-31', $year));
        $offset = ((int) $date->format('w') + 6) % 7;
        return $date->modify('-' . $offset . ' days')->format('Y-m-d');
    }
}
