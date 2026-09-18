INSERT INTO notification_templates (template_key, name, channel, subject, body, is_active) VALUES
('appointment_request_submitted_patient', 'Appointment Request Submitted - Patient', 'email',
 'Appointment Request Submitted - Aromin-Sison Dental Clinic',
 'Your appointment request has been successfully submitted and is now waiting for the clinic''s review.

Appointment ID: {appointment_id}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}

The clinic will review your appointment details and notify you once your request has been confirmed. Please make sure that your contact information is correct so the clinic can reach you if there are any updates.',
 1),
('appointment_request_submitted_staff', 'New Appointment Request - Admin/Receptionist', 'email',
 'New Appointment Request - Aromin-Sison Dental Clinic',
 'A new appointment request has been submitted by a patient and is ready for review.

Appointment ID: {appointment_id}
Patient: {patient_name}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}

Please review the appointment details and update the appointment status accordingly. Make sure the schedule and assigned dentist are correct before confirming the appointment.',
 1),
('appointment_confirmed_patient', 'Appointment Confirmed - Patient', 'email',
 'Appointment Confirmed - Aromin-Sison Dental Clinic',
 'Your appointment has been confirmed by the clinic. Please take note of the appointment details below.

Appointment ID: {appointment_id}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}

Please arrive on time for your appointment and keep your appointment details for reference. If you need to make any changes, please contact the clinic as soon as possible.',
 1),
('appointment_confirmed_staff', 'Appointment Confirmed - Admin/Receptionist', 'email',
 'Appointment Confirmed - Aromin-Sison Dental Clinic',
 'The patient''s appointment has been successfully confirmed.

Appointment ID: {appointment_id}
Patient: {patient_name}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}

The appointment is now confirmed and included in the clinic''s schedule. Please ensure that the assigned dentist and appointment details are properly recorded.',
 1),
('appointment_cancelled_patient', 'Appointment Cancelled - Patient', 'email',
 'Appointment Cancelled - Aromin-Sison Dental Clinic',
 'Your appointment has been cancelled. Please see the appointment details and cancellation information below.

Appointment ID: {appointment_id}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}
Reason: {reason}

The cancelled appointment will no longer be included in your upcoming schedule. If you still need the treatment, you may book a new appointment based on the available schedule.',
 1),
('appointment_cancelled_staff', 'Appointment Cancelled - Admin/Receptionist', 'email',
 'Appointment Cancelled - Aromin-Sison Dental Clinic',
 'An appointment has been cancelled and the schedule has been updated.

Appointment ID: {appointment_id}
Patient: {patient_name}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}
Reason: {reason}

Please take note of the cancellation and ensure that the appointment slot is properly reflected in the clinic schedule.',
 1),
('appointment_rescheduled_patient', 'Appointment Rescheduled - Patient', 'email',
 'Appointment Rescheduled - Aromin-Sison Dental Clinic',
 'Your appointment has been rescheduled. Please review the updated schedule below.

Appointment ID: {appointment_id}
Service: {service}
Previous Date: {previous_date}
Previous Time: {previous_time}
New Date: {new_date}
New Time: {new_time}
Dentist: {dentist_name}

Please take note of your new appointment date and time. If the updated schedule is not suitable, please contact the clinic for further assistance.',
 1),
('appointment_rescheduled_staff', 'Appointment Rescheduled - Admin/Receptionist', 'email',
 'Appointment Rescheduled - Aromin-Sison Dental Clinic',
 'An appointment has been rescheduled and the patient''s schedule has been updated.

Appointment ID: {appointment_id}
Patient: {patient_name}
Service: {service}
Previous Date: {previous_date}
Previous Time: {previous_time}
New Date: {new_date}
New Time: {new_time}
Dentist: {dentist_name}

Please ensure that the new schedule is properly reflected in the appointment records and that the assigned dentist is informed of the updated schedule.',
 1),
('appointment_rejected_patient', 'Appointment Rejected - Patient', 'email',
 'Appointment Request Update - Aromin-Sison Dental Clinic',
 'Your appointment request could not be confirmed by the clinic.

Appointment ID: {appointment_id}
Service: {service}
Requested Date: {appointment_date}
Requested Time: {appointment_time}
Dentist: {dentist_name}
Reason: {reason}

Please review the reason provided and consider selecting another available date or time. You may submit a new appointment request through the patient portal.',
 1),
('appointment_reminder_patient', 'Appointment Reminder - Patient', 'email',
 'Appointment Reminder - Aromin-Sison Dental Clinic',
 'This is a friendly reminder that you have an upcoming dental appointment at Aromin-Sison Dental Clinic.

Appointment ID: {appointment_id}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}

Please arrive on time for your scheduled appointment to allow the clinic to assist you promptly. If you are unable to attend or need to make changes to your appointment, please contact the clinic as soon as possible.',
 1),
('appointment_completed_patient', 'Appointment Completed - Patient', 'email',
 'Appointment Completed - Aromin-Sison Dental Clinic',
 'Your dental appointment has been completed successfully.

Appointment ID: {appointment_id}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}

The completed appointment has been recorded in your account. Any available treatment details or records related to this visit may be viewed through your patient portal.',
 1),
('appointment_no_show_patient', 'Did Not Attend / No-Show - Patient', 'email',
 'Missed Appointment - Aromin-Sison Dental Clinic',
 'Our records show that you were unable to attend your scheduled appointment.

Appointment ID: {appointment_id}
Service: {service}
Date: {appointment_date}
Time: {appointment_time}
Dentist: {dentist_name}

The appointment has been marked as Did Not Attend. If you still need the scheduled treatment, you may book a new appointment based on the clinic''s available schedule.',
 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    channel = VALUES(channel),
    subject = VALUES(subject),
    body = VALUES(body),
    is_active = VALUES(is_active);
