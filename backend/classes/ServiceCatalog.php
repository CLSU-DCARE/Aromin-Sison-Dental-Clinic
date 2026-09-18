<?php
namespace ASDC;

class ServiceCatalog
{
    private const APPOINTMENT_SERVICES = [
        'Braces Adjustment',
        'Cleaning & Check-up',
        'Consultation',
        'Teeth Whitening',
    ];

    public static function isAppointmentService(string $service): bool
    {
        return in_array($service, self::APPOINTMENT_SERVICES, true);
    }

    public static function appointmentServices(): array
    {
        return self::APPOINTMENT_SERVICES;
    }
}
