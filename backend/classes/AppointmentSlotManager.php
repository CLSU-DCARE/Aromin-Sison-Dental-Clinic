<?php
/**
 * Appointment slot locking and availability: Aromin-Sison Dental Clinic System.
 *
 * Uses MySQL GET_LOCK for pessimistic row-level locking during booking.
 * Usage:
 *   $lock = AppointmentSlotManager::lock($pdo, $date, $time);
 *   // ... do work ...
 *   AppointmentSlotManager::unlock($pdo, $lock);
 */

namespace ASDC;

use PDO;

class AppointmentSlotManager
{
    public static function lock(PDO $pdo, string $date, string $time): string
    {
        $name = 'asdc_slot_' . $date . '_' . str_replace(':', '', $time);
        $stmt = $pdo->prepare('SELECT GET_LOCK(?, 5)');
        $stmt->execute([$name]);
        if ((int) $stmt->fetchColumn() !== 1) {
            ApiResponse::error(503, 'slot_lock_timeout', 'The slot is busy. Please try again.');
        }
        return $name;
    }

    public static function unlock(PDO $pdo, string $name): void
    {
        $stmt = $pdo->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->execute([$name]);
    }

    public static function isTaken(
        PDO $pdo,
        string $date,
        string $time,
        ?int $excludeAppointment = null,
        ?int $excludeRequest = null,
        ?int $dentistId = null
    ): bool {
        $sql = "SELECT 1 FROM appointments WHERE scheduled_date=? AND scheduled_time=? AND status IN ('pending','confirmed')";
        $params = [$date, $time];
        if ($dentistId) {
            $sql .= ' AND dentist_id=?';
            $params[] = $dentistId;
        }
        if ($excludeAppointment) {
            $sql .= ' AND appointment_id<>?';
            $params[] = $excludeAppointment;
        }
        $sql .= ' LIMIT 1';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        if ($stmt->fetchColumn()) {
            return true;
        }

        $sql = "SELECT 1 FROM appointment_requests WHERE requested_date=? AND requested_time=? AND status IN ('pending','rescheduled')";
        $params = [$date, $time];
        if ($dentistId) {
            $sql .= ' AND preferred_dentist_id=?';
            $params[] = $dentistId;
        }
        if ($excludeRequest) {
            $sql .= ' AND request_id<>?';
            $params[] = $excludeRequest;
        }
        $sql .= ' LIMIT 1';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return (bool) $stmt->fetchColumn();
    }
}
