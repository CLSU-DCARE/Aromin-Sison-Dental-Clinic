<?php
namespace ASDC;

/** Appointment choices retained from the former patient booking form. */
class AppointmentTimes
{
    public const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30'];

    public static function allows($time): bool
    {
        $normalised = InputValidator::time($time);
        return $normalised !== null && substr($normalised, 6) === '00'
            && in_array(substr($normalised, 0, 5), self::TIMES, true);
    }

    public static function requireAllowed($time, string $field): void
    {
        if (!self::allows($time)) {
            $message = 'Choose a clinic appointment time from the available choices.';
            ApiResponse::error(422, 'validation_failed', $message, [$field=>$message]);
        }
    }
}
