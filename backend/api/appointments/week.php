<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/appointments.php';
require_role('admin', 'staff');
appointment_assert_method('GET');

$start = appointment_date($_GET['start'] ?? date('Y-m-d', strtotime('monday this week')));
if (!$start) appointment_error(422, 'validation_failed', 'Start must use YYYY-MM-DD.', ['start' => 'Invalid date.']);
$end = date('Y-m-d', strtotime($start . ' +6 days'));
$stmt = $pdo->prepare("SELECT a.appointment_id,a.patient_id,CONCAT(p.first_name,' ',p.last_name) patient_name,p.contact_number,p.email,a.dentist_id,d.full_name dentist_name,a.service_type,a.scheduled_date,a.scheduled_time,a.status,a.notes FROM appointments a JOIN patients p ON p.patient_id=a.patient_id LEFT JOIN users d ON d.user_id=a.dentist_id WHERE a.scheduled_date BETWEEN ? AND ? ORDER BY a.scheduled_date,a.scheduled_time");
$stmt->execute([$start,$end]);
$appointments = $stmt->fetchAll();
$stmt = $pdo->prepare("SELECT r.request_id,CONCAT(r.first_name,' ',r.last_name) patient_name,r.contact_number,r.email,r.preferred_dentist_id,d.full_name dentist_name,r.service_type,r.requested_date scheduled_date,r.requested_time scheduled_time,r.status,r.notes FROM appointment_requests r LEFT JOIN users d ON d.user_id=r.preferred_dentist_id WHERE r.requested_date BETWEEN ? AND ? AND r.status IN ('pending','rescheduled') ORDER BY r.requested_date,r.requested_time");
$stmt->execute([$start,$end]);
appointment_ok(['week_start'=>$start,'week_end'=>$end,'appointments'=>$appointments,'requests'=>$stmt->fetchAll()]);
