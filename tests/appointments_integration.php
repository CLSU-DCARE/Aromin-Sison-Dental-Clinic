<?php
require __DIR__ . '/../backend/config/db.php';
if (!is_dir(__DIR__ . '/sessions')) mkdir(__DIR__ . '/sessions', 0700, true);
ini_set('session.save_path', __DIR__ . '/sessions');

$base = 'http://127.0.0.1:8765';
$suffix = bin2hex(random_bytes(4));
$email = "module3-$suffix@example.test";
$phone = '0917' . random_int(1000000, 9999999);
$password = 'Module3Test!2026';
$createdUserIds = [];
$results = [];

function request(string $base, string $path, string $method='GET', ?array $body=null, ?string $session=null): array {
    $headers = ['Accept: application/json'];
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    if ($session) $headers[] = 'Cookie: ASDC_SESSION=' . $session;
    $context = stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>$body === null ? '' : json_encode($body),'ignore_errors'=>true]]);
    $raw = file_get_contents($base . $path, false, $context);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $match);
    return [(int)($match[1] ?? 0), json_decode($raw ?: '{}', true), $raw, $http_response_header ?? []];
}

function login(string $base, string $email, string $password): string {
    $response=request($base,'/backend/api/auth/login.php','POST',['email'=>$email,'password'=>$password]);
    foreach($response[3] as $header) if(preg_match('/^Set-Cookie:\s*ASDC_SESSION=([^;]+)/i',$header,$match)) return $match[1];
    throw new RuntimeException('Login did not return a session cookie: '.$response[2]);
}

function check_result(array &$results, string $name, int $expected, array $response): void {
    $ok = $response[0] === $expected;
    $results[] = [$name,$ok,"expected $expected, got {$response[0]}"];
}

try {
    $stmt=$pdo->prepare("INSERT INTO users(role,email,password_hash,full_name,is_active) VALUES('staff',?,?,?,1)");
    $stmt->execute(["staff-$email",password_hash($password,PASSWORD_DEFAULT),'Module 3 Staff']);
    $staffId=(int)$pdo->lastInsertId(); $createdUserIds[]=$staffId;
    $stmt=$pdo->prepare("INSERT INTO users(role,email,password_hash,full_name,is_active) VALUES('patient',?,?,?,1)");
    $stmt->execute([$email,password_hash($password,PASSWORD_DEFAULT),'Module 3 Patient']);
    $patientUserId=(int)$pdo->lastInsertId(); $createdUserIds[]=$patientUserId;
    $stmt=$pdo->prepare('INSERT INTO patients(user_id,first_name,last_name,contact_number,email) VALUES(?,?,?,?,?)');
    $stmt->execute([$patientUserId,'Module','Three',$phone,$email]);
    $patientId=(int)$pdo->lastInsertId();
    $staffSession=login($base,"staff-$email",$password);
    $patientSession=login($base,$email,$password);
    $date=date('Y-m-d',strtotime('+30 days'));
    $date2=date('Y-m-d',strtotime('+31 days'));

    check_result($results,'weekly view requires login',401,request($base,'/backend/api/appointments/week.php'));
    check_result($results,'patient forbidden from staff weekly view',403,request($base,'/backend/api/appointments/week.php','GET',null,$patientSession));
    check_result($results,'public validation failure',422,request($base,'/backend/api/public/appointment-requests.php','POST',['first_name'=>'Only']));
    $booking=['first_name'=>'Module','last_name'=>'Three','email'=>$email,'contact_number'=>$phone,'service_type'=>'Consultation','requested_date'=>$date,'requested_time'=>'09:00'];
    $response=request($base,'/backend/api/public/appointment-requests.php','POST',$booking);
    check_result($results,'public booking success',201,$response);
    $requestId=(int)($response[1]['data']['request_id'] ?? 0);
    check_result($results,'public double-booking rejected',409,request($base,'/backend/api/public/appointment-requests.php','POST',$booking));
    check_result($results,'patient forbidden from staff actions',403,request($base,'/backend/api/appointments/actions.php','POST',['action'=>'cancel','resource_type'=>'request','request_id'=>$requestId],$patientSession));
    check_result($results,'staff weekly view success',200,request($base,'/backend/api/appointments/week.php?start='.$date,'GET',null,$staffSession));
    check_result($results,'staff approves public request',200,request($base,'/backend/api/appointments/actions.php','POST',['action'=>'approve','resource_type'=>'request','request_id'=>$requestId],$staffSession));
    $stmt=$pdo->prepare("INSERT INTO appointment_requests(first_name,last_name,email,contact_number,service_type,requested_date,requested_time) VALUES('Conflict','Approval',?,?,? ,?,?)");
    $stmt->execute([$email,$phone,'Consultation',$date,'09:00']);
    $conflictRequestId=(int)$pdo->lastInsertId();
    check_result($results,'staff conflicting approval rejected',409,request($base,'/backend/api/appointments/actions.php','POST',['action'=>'approve','resource_type'=>'request','request_id'=>$conflictRequestId],$staffSession));
    $patientBooking=['service_type'=>'Consultation','scheduled_date'=>$date,'scheduled_time'=>'09:00'];
    check_result($results,'patient conflicting booking rejected',409,request($base,'/backend/api/patients/appointments.php','POST',$patientBooking,$patientSession));
    $patientBooking['scheduled_date']=$date2;
    $response=request($base,'/backend/api/patients/appointments.php','POST',$patientBooking,$patientSession);
    check_result($results,'patient booking success',201,$response);
    $appointmentId=(int)($response[1]['data']['appointment_id'] ?? 0);
    check_result($results,'patient upcoming/history fetch',200,request($base,'/backend/api/patients/appointments.php','GET',null,$patientSession));
    check_result($results,'staff conflicting reschedule rejected',409,request($base,'/backend/api/appointments/actions.php','PATCH',['action'=>'reschedule','appointment_id'=>$appointmentId,'scheduled_date'=>$date,'scheduled_time'=>'09:00'],$staffSession));
    check_result($results,'staff reschedule success',200,request($base,'/backend/api/appointments/actions.php','PATCH',['action'=>'reschedule','appointment_id'=>$appointmentId,'scheduled_date'=>$date2,'scheduled_time'=>'10:00'],$staffSession));
    check_result($results,'staff approve appointment success',200,request($base,'/backend/api/appointments/actions.php','POST',['action'=>'approve','appointment_id'=>$appointmentId],$staffSession));
    check_result($results,'staff cancel appointment success',200,request($base,'/backend/api/appointments/actions.php','POST',['action'=>'cancel','appointment_id'=>$appointmentId],$staffSession));
} finally {
    if (isset($patientId)) {
        $pdo->prepare('DELETE FROM appointment_requests WHERE email=?')->execute([$email]);
        $pdo->prepare('DELETE FROM patients WHERE patient_id=?')->execute([$patientId]);
    }
    foreach (array_reverse($createdUserIds) as $id) $pdo->prepare('DELETE FROM users WHERE user_id=?')->execute([$id]);
    foreach ([$staffSession ?? null, $patientSession ?? null] as $sessionId) {
        if ($sessionId) @unlink(__DIR__ . '/sessions/sess_' . $sessionId);
    }
}

$failed=0;
foreach($results as [$name,$ok,$detail]) { echo ($ok?'PASS':'FAIL'), ' - ', $name, $ok?'':" ($detail)", PHP_EOL; if(!$ok)$failed++; }
exit($failed ? 1 : 0);
