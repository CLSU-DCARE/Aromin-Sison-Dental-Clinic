<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/appointments.php';
require_role('receptionist', 'dentist');
appointment_assert_method('POST', 'PATCH');
$body = appointment_body();
$action = isset($body['action']) && is_string($body['action']) ? strtolower(trim($body['action'])) : '';
$type = ($body['resource_type'] ?? 'appointment') === 'request' ? 'request' : 'appointment';
$id = appointment_positive_id($body[$type === 'request' ? 'request_id' : 'appointment_id'] ?? null);
if (!in_array($action, ['approve','reschedule','cancel'], true) || !$id) appointment_error(422, 'validation_failed', 'A valid action and resource identifier are required.');

if ($action === 'cancel') {
    $table = $type === 'request' ? 'appointment_requests' : 'appointments';
    $key = $type === 'request' ? 'request_id' : 'appointment_id';
    $stmt = $pdo->prepare("UPDATE $table SET status='cancelled'" . ($type === 'request' ? ', reviewed_by=?, reviewed_at=NOW()' : '') . " WHERE $key=? AND status<>'cancelled'");
    $stmt->execute($type === 'request' ? [(int)$_SESSION['user_id'],$id] : [$id]);
    if (!$stmt->rowCount()) appointment_error(404, 'not_found', 'Active appointment record not found.');
    appointment_ok([$key=>$id,'status'=>'cancelled'], 'Appointment cancelled.');
}

if ($action === 'reschedule') {
    [$date,$time] = appointment_validate_slot($body, 'scheduled_date', 'scheduled_time');
    $lock = appointment_lock($pdo,$date,$time);
    try {
        $pdo->beginTransaction();
        if ($type === 'request') {
            $stmt=$pdo->prepare("SELECT request_id FROM appointment_requests WHERE request_id=? AND status IN ('pending','rescheduled') FOR UPDATE"); $stmt->execute([$id]);
            if (!$stmt->fetch()) { $pdo->rollBack(); appointment_error(404,'not_found','Active appointment request not found.'); }
            if (appointment_slot_taken($pdo,$date,$time,null,$id)) { $pdo->rollBack(); appointment_error(409,'slot_unavailable','That appointment slot is no longer available.'); }
            $stmt=$pdo->prepare("UPDATE appointment_requests SET requested_date=?,requested_time=?,status='rescheduled',reviewed_by=?,reviewed_at=NOW() WHERE request_id=?");
            $stmt->execute([$date,$time,(int)$_SESSION['user_id'],$id]);
        } else {
            $stmt=$pdo->prepare("SELECT appointment_id FROM appointments WHERE appointment_id=? AND status IN ('pending','confirmed') FOR UPDATE"); $stmt->execute([$id]);
            if (!$stmt->fetch()) { $pdo->rollBack(); appointment_error(404,'not_found','Active appointment not found.'); }
            if (appointment_slot_taken($pdo,$date,$time,$id,null)) { $pdo->rollBack(); appointment_error(409,'slot_unavailable','That appointment slot is no longer available.'); }
            $stmt=$pdo->prepare("UPDATE appointments SET scheduled_date=?,scheduled_time=? WHERE appointment_id=?"); $stmt->execute([$date,$time,$id]);
        }
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); error_log($e->getMessage()); appointment_error(500,'reschedule_failed','Unable to reschedule the appointment.'); }
    finally { appointment_unlock($pdo,$lock); }
    appointment_ok(['id'=>$id,'scheduled_date'=>$date,'scheduled_time'=>$time], 'Appointment rescheduled.');
}

if ($type === 'appointment') {
    $stmt=$pdo->prepare("SELECT scheduled_date,scheduled_time FROM appointments WHERE appointment_id=? AND status='pending'"); $stmt->execute([$id]); $row=$stmt->fetch();
    if (!$row) appointment_error(404,'not_found','Pending appointment not found.');
    $lock=appointment_lock($pdo,$row['scheduled_date'],$row['scheduled_time']);
    try { $pdo->beginTransaction(); $stmt=$pdo->prepare("SELECT appointment_id,scheduled_date,scheduled_time FROM appointments WHERE appointment_id=? AND status='pending' FOR UPDATE"); $stmt->execute([$id]); $locked=$stmt->fetch(); if (!$locked || $locked['scheduled_date'] !== $row['scheduled_date'] || $locked['scheduled_time'] !== $row['scheduled_time']) { $pdo->rollBack(); appointment_error(409,'state_changed','Appointment state changed; retry the action.'); } if (appointment_slot_taken($pdo,$row['scheduled_date'],$row['scheduled_time'],$id,null)) { $pdo->rollBack(); appointment_error(409,'slot_unavailable','That appointment slot is no longer available.'); } $pdo->prepare("UPDATE appointments SET status='confirmed' WHERE appointment_id=?")->execute([$id]); $pdo->commit(); } catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); appointment_error(500,'approval_failed','Unable to approve the appointment.'); } finally { appointment_unlock($pdo,$lock); }
    appointment_ok(['appointment_id'=>$id,'status'=>'confirmed'],'Appointment approved.');
}

$stmt=$pdo->prepare("SELECT * FROM appointment_requests WHERE request_id=? AND status IN ('pending','rescheduled')"); $stmt->execute([$id]); $request=$stmt->fetch();
if(!$request) appointment_error(404,'not_found','Pending appointment request not found.');
$initialRequest=$request;
$lock=appointment_lock($pdo,$request['requested_date'],$request['requested_time']);
try {
    $pdo->beginTransaction();
    $stmt=$pdo->prepare("SELECT * FROM appointment_requests WHERE request_id=? AND status IN ('pending','rescheduled') FOR UPDATE"); $stmt->execute([$id]); $request=$stmt->fetch();
    if(!$request || $request['requested_date'] !== $initialRequest['requested_date'] || $request['requested_time'] !== $initialRequest['requested_time']){$pdo->rollBack();appointment_error(409,'state_changed','Appointment request state changed; retry the action.');}
    if(appointment_slot_taken($pdo,$request['requested_date'],$request['requested_time'],null,$id)){$pdo->rollBack();appointment_error(409,'slot_unavailable','That appointment slot is no longer available.');}
    $patient=null;
    if($request['email']){$stmt=$pdo->prepare('SELECT patient_id FROM patients WHERE email=? ORDER BY user_id IS NOT NULL DESC LIMIT 1');$stmt->execute([$request['email']]);$patient=$stmt->fetchColumn();}
    if(!$patient){$stmt=$pdo->prepare('SELECT patient_id FROM patients WHERE contact_number=? ORDER BY user_id IS NOT NULL DESC LIMIT 1');$stmt->execute([$request['contact_number']]);$patient=$stmt->fetchColumn();}
    if(!$patient){$stmt=$pdo->prepare('INSERT INTO patients(first_name,last_name,contact_number,email) VALUES(?,?,?,?)');$stmt->execute([$request['first_name'],$request['last_name'],$request['contact_number'],$request['email']]);$patient=(int)$pdo->lastInsertId();}
    $stmt=$pdo->prepare("INSERT INTO appointments(patient_id,dentist_id,service_type,scheduled_date,scheduled_time,status,notes) VALUES(?,?,?,?,?,'confirmed',?)");$stmt->execute([(int)$patient,$request['preferred_dentist_id'],$request['service_type'],$request['requested_date'],$request['requested_time'],$request['notes']]);$appointmentId=(int)$pdo->lastInsertId();
    $stmt=$pdo->prepare("UPDATE appointment_requests SET status='approved',appointment_id=?,reviewed_by=?,reviewed_at=NOW() WHERE request_id=?");$stmt->execute([$appointmentId,(int)$_SESSION['user_id'],$id]);
    $pdo->commit();
} catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();error_log($e->getMessage());appointment_error(500,'approval_failed','Unable to approve the appointment request.');} finally {appointment_unlock($pdo,$lock);}
appointment_ok(['request_id'=>$id,'appointment_id'=>$appointmentId,'status'=>'approved'],'Appointment request approved.');
