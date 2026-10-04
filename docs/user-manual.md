# Aromin-Sison Dental Clinic System User Manual

Version: 1.0  
Prepared for: Aromin-Sison Dental Clinic  
System modules: Public Website, Patient Portal, Receptionist Portal, Dentist Portal

## 1. Introduction

The Aromin-Sison Dental Clinic system is a web-based clinic management platform for handling patient accounts, appointment booking, treatment records, braces contracts, billing, payment verification, notifications, promotions, and attendance reports.

The system has four main user areas:

- Public Website: for visitors and patients who want to view clinic information, services, dentists, gallery photos, promotions, and booking forms.
- Patient Portal: for registered patients who need to manage appointments, view treatment details, upload payment proof, and read clinic announcements.
- Receptionist Portal: for clinic staff who manage patients, booking requests, appointments, promotions, billing, notifications, inventory, and reports.
- Dentist Portal: for dentists who review assigned patients, update treatment records, track braces progress, monitor appointments, and view reports.

## 2. System Access

### 2.1 Recommended Requirements

- A modern browser such as Google Chrome, Microsoft Edge, or Mozilla Firefox.
- Stable internet or local network access to the clinic system.
- A valid user account for restricted areas.
- For local deployment, Apache, PHP, and MySQL through XAMPP or Laragon.

### 2.2 Main Pages

- Public Website: `public-website/index.html`
- General Login: `auth/login.html`
- Patient Login: `auth/patient-login.html`
- Patient Signup: `auth/patient-signup.html`
- Admin/Receptionist Login: `auth/admin-login.html`
- Receptionist Portal: `admin-system/dashboard.html`
- Dentist Portal: `dentist-dashboard/dashboard.html`
- Patient Portal: `patient-dashboard/dashboard.html`

## 3. User Roles

### 3.1 Public Visitor

Public visitors can:

- View the clinic homepage.
- Read clinic information and services.
- View dentist profiles and gallery images.
- Submit appointment booking requests.
- Register for a patient account.

### 3.2 Patient

Patients can:

- Log in to their portal.
- View personal profile information.
- Book appointments.
- View upcoming and past appointments.
- Request appointment rescheduling.
- View treatment history.
- View braces contract and progress when applicable.
- Submit proof of payment.
- Track submitted payment status.
- View promotions and announcements.
- Read notifications.

### 3.3 Receptionist

Receptionists can:

- View clinic dashboard statistics.
- Add, edit, archive, and restore patient records.
- Review booking requests from the public website.
- Confirm, reschedule, cancel, and manage appointments.
- Create and monitor braces contracts.
- Review and approve or reject payment submissions.
- Manage promotions shown to patients and public visitors.
- Manage inventory items.
- Send notifications to patients.
- View and download patient, contract, billing, and attendance reports.

### 3.4 Dentist

Dentists can:

- View assigned dashboard data.
- View patient records.
- Add treatment records.
- View archived patient charts in read-only mode.
- View braces contracts.
- Update braces treatment progress.
- Monitor payment and billing records.
- Manage or review appointments.
- View attendance reports.

## 4. Public Website Manual

### 4.1 Viewing Clinic Information

1. Open the public website homepage.
2. Use the navigation menu to browse Home, About, Dentists, Gallery, Services, and other available sections.
3. Select any service or dentist profile to learn more about the clinic.

### 4.2 Sending an Appointment Request

1. Open the public website appointment or booking section.
2. Enter the required patient information.
3. Select the service, preferred date, and preferred time.
4. Submit the booking request.
5. Wait for clinic staff to approve, reject, or reschedule the request.

### 4.3 Registering as a Patient

1. Open the patient signup page.
2. Fill in the required account and patient details.
3. Submit the registration form.
4. After successful registration, log in through the patient login page.

## 5. Patient Portal Manual

### 5.1 Logging In

1. Open `auth/patient-login.html`.
2. Enter the registered email address and password.
3. Click the login button.
4. After successful login, the system opens the patient dashboard.

### 5.2 Using the Patient Dashboard

The dashboard shows:

- Welcome message.
- Upcoming appointments.
- Clinic announcements and promotions.
- Quick access to booking and schedule pages.
- Sync status with the clinic server.

### 5.3 Viewing and Updating Profile

1. Click My Profile in the sidebar.
2. Review personal information, member since date, and primary dentist.
3. If profile editing is available, update the editable fields and save changes.

### 5.4 Booking an Appointment

1. Click Book Appointment.
2. Select a service.
3. Choose the preferred appointment date.
4. Select an available time slot.
5. Review the booking summary.
6. Click Confirm Booking.
7. Wait for staff confirmation when required.

### 5.5 Viewing Appointment Schedule

1. Click My Schedule.
2. Review upcoming appointments.
3. Check the appointment date, time, service, dentist, and status.

### 5.6 Rescheduling an Appointment

1. Open My Schedule.
2. Find the appointment to reschedule.
3. Click the reschedule action if available.
4. Select a new date and time.
5. Save the changes.
6. Wait for clinic confirmation if the new schedule requires approval.

### 5.7 Viewing Appointment History

1. Click Appointment History.
2. Review past visits, services, dentists, and appointment statuses.

### 5.8 Viewing Treatment History

1. Click Treatment History.
2. Review treatment dates, procedures, dentists, and notes.

### 5.9 Viewing Braces Contract

1. Click Braces Contract if the option is visible.
2. Review contract details, payment progress, treatment stages, and next adjustment notes.
3. Click Download Contract if a downloadable contract is available.

### 5.10 Submitting Payment Proof

1. Click Payment and Billing.
2. Review the GCash payment details or selected payment method.
3. Enter the payment amount.
4. Upload a clear receipt image.
5. Add an optional note if needed.
6. Click Submit.
7. Wait for staff approval. The payment remains Pending until reviewed.

### 5.11 Viewing Payment Status

1. Open Payment and Billing.
2. Review My Payment Submissions.
3. Check whether each submission is Pending, Approved, or Rejected.
4. If rejected, read the reason and submit a corrected proof if needed.

### 5.12 Reading Announcements

1. Click Announcements.
2. Browse current clinic promotions and updates.
3. Select a promotion card to view more details when available.

### 5.13 Logging Out

1. Click the account menu or logout icon.
2. Confirm logout.
3. The system returns to the login or public page.

## 6. Receptionist Portal Manual

### 6.1 Logging In

1. Open `auth/admin-login.html`.
2. Enter the receptionist account credentials.
3. Click Login.
4. The Receptionist Portal opens after successful authentication.

### 6.2 Dashboard

The dashboard provides:

- Clinic summary statistics.
- Weekly schedule overview.
- Today's queue.
- Quick access to appointment creation.

### 6.3 Managing Patients

To add a patient:

1. Click Patient Management.
2. Click Add Patient.
3. Enter full name, contact number, email address, last visit, and status.
4. Click Add Patient.

To edit a patient:

1. Open Patient Management.
2. Locate the patient.
3. Open the patient action menu or details view.
4. Update the information.
5. Save changes.

To archive a patient:

1. Open Patient Management.
2. Locate the inactive or no longer active patient.
3. Select the archive or delete action.
4. Confirm the action.

### 6.4 Managing Archived Patients

1. Click Archived Patients.
2. Review archived patient profiles.
3. Open a patient detail view to inspect retained clinical and billing information.
4. Restore the patient if restoration is available and appropriate.

### 6.5 Viewing Treatment Records

1. Click Treatment Records.
2. Use filter chips such as All, Treatments, Preventive, or Consultation.
3. Review patient, category, details, and date.

### 6.6 Managing Booking Requests

1. Click Appointment Scheduling.
2. Review Pending Booking Requests.
3. For each request, choose the appropriate action:
   - Confirm: accepts the requested appointment.
   - Reschedule: proposes a new date and time.
   - Reject or cancel: declines the request when necessary.
4. Refresh the schedule to verify the latest status.

### 6.7 Managing the Weekly Schedule

1. Open Appointment Scheduling.
2. Use Week, Day, or List view.
3. Use Previous, This Week, and Next to navigate dates.
4. Select appointment actions to confirm, reschedule, cancel, mark attendance, or update appointment status.

### 6.8 Managing Braces Contracts

To create a contract:

1. Click Braces Contracts.
2. Click New Contract.
3. Select the patient.
4. Enter duration in months.
5. Enter monthly payment amount.
6. Select treating dentist.
7. Select contract status.
8. Click Create Contract.

To monitor contracts:

1. Use filters such as All, Current, Completed, and Overdue.
2. Review monthly amount, amount paid, balance, due status, and progress.
3. Download reports when needed.

### 6.9 Managing Promotions

1. Click Promotions.
2. Click New Promotion.
3. Enter title and description.
4. Upload an optional promotion image.
5. Select start date, end date, and status.
6. Click Save Promotion.
7. Confirm that the promotion appears in the patient portal or public site when live.

### 6.10 Reviewing Payments

1. Click Payment and Billing.
2. Filter payment submissions by status.
3. Open a submitted payment to review receipt details.
4. Approve the payment if valid.
5. Reject the payment and provide a reason if the receipt or amount is invalid.

### 6.11 Managing Inventory

1. Open the Inventory section if available in the portal.
2. Click Add Inventory Item.
3. Enter item name, category, stock quantity, unit, reorder point, and last restocked date.
4. Save the item.
5. Monitor low-stock items and update stock counts after restocking or usage.

### 6.12 Sending Notifications

1. Click Notifications.
2. Click Send Notification.
3. Select a patient.
4. Choose an existing template or write a custom message.
5. Enter the subject and message body.
6. Click Send Notification.
7. Check notification history for successful or failed messages.

### 6.13 Viewing Reports

1. Click Attendance Reports.
2. Select the report period.
3. Review appointment attendance statistics.
4. Download reports when needed for clinic records.

### 6.14 Logging Out

1. Click the logout icon in the sidebar or account menu.
2. Confirm logout.

## 7. Dentist Portal Manual

### 7.1 Logging In

1. Open the dentist login route provided by the clinic system.
2. Enter dentist account credentials.
3. After successful login, the Dentist Portal opens.

### 7.2 Dashboard

The dashboard shows:

- Weekly appointment schedule.
- Today's queue.
- Assigned clinic activity.
- Quick access to appointment scheduling.

### 7.3 Viewing Patients

1. Click Patients.
2. Use filters such as All, Active, or Inactive.
3. Review contact information, last visit, and patient status.

### 7.4 Adding Treatment Records

1. Click Treatment Records.
2. Click Add treatment record.
3. Select or search for the patient.
4. Enter procedure or treatment details.
5. Select date, dentist, category, and status.
6. Save the treatment record.

### 7.5 Viewing Archived Patient Charts

1. Click Archived Patients.
2. Select a patient to view retained chart details.
3. Use this area as read-only reference unless the system allows restoration through receptionist access.

### 7.6 Managing Braces Progress

1. Click Braces Contracts.
2. Locate the patient contract.
3. Open the progress update action.
4. Select the current stage:
   - Consultation and Records
   - Braces Placement
   - Adjustment Phase
   - Retainer Fitting
   - Debonding and Retention
5. Enter progress percentage.
6. Add a progress note shown to the patient.
7. Add the next adjustment note.
8. Save progress.

### 7.7 Viewing Payments

1. Click Payment and Billing.
2. Review patient amount, payment method, due date, submitted date, and status.
3. Use this information for treatment and contract awareness.

### 7.8 Managing Appointments

1. Click Appointments.
2. Use Week, Day, or List view.
3. Navigate with Previous, This Week, and Next.
4. Review appointment status and assigned patients.
5. Use available appointment actions according to dentist permissions.

### 7.9 Viewing Attendance Reports

1. Click Attendance Reports.
2. Select This week, Last week, or This month.
3. Review attendance percentage, attended count, missed count, upcoming count, and daily records.

### 7.10 Logging Out

1. Click the logout icon or account menu.
2. Confirm logout.

## 8. Account and Session Features

### 8.1 Forgot Password

1. Open the forgot password page.
2. Enter the email address connected to the account.
3. Submit the request.
4. Follow the reset instructions sent by email.
5. Create a new password on the reset password page.

### 8.2 Remembered Sessions

The system supports secure session handling. Users should still log out after using shared clinic devices.

### 8.3 Profile Pictures

If enabled, users may upload or update profile pictures through account profile controls.

## 9. Common Status Meanings

- Pending: waiting for staff review or confirmation.
- Confirmed: accepted and scheduled.
- Completed: finished appointment, treatment, or payment.
- Cancelled: no longer active.
- Rescheduled: moved to a new date or time.
- Rejected: declined because details were invalid, incomplete, or not approved.
- Overdue: payment or contract obligation has passed its due date.
- Archived: retained record that is no longer active.

## 10. Data Privacy and Proper Use

- Do not share login credentials.
- Always log out on shared computers.
- Only access patient records needed for clinic duties.
- Verify patient identity before updating records or billing information.
- Upload only valid payment receipts and clinic-related images.
- Do not store real passwords inside project files.
- Keep patient records accurate and updated.

## 11. Troubleshooting

### 11.1 Cannot Log In

- Check email and password.
- Confirm that the account exists.
- Use forgot password if needed.
- Ask an authorized staff member to verify account status.

### 11.2 Dashboard Does Not Load Data

- Refresh the page.
- Check internet or local network connection.
- Confirm that the backend server and database are running.
- Log out and log in again.

### 11.3 Appointment Slot Is Unavailable

- Choose another time or date.
- Contact clinic staff if the selected schedule should be available.

### 11.4 Payment Upload Fails

- Use a clear image file.
- Check that the receipt file is not too large.
- Confirm the amount field is filled in correctly.
- Refresh and submit again.

### 11.5 Email Notifications Are Not Sending

- Confirm email settings are configured on the server.
- Check the Gmail app password or SMTP configuration.
- Review notification logs for failed messages.

## 12. Recommended Daily Workflow

### Receptionist

1. Log in at the start of the clinic day.
2. Check Today's Queue and weekly schedule.
3. Review pending booking requests.
4. Confirm, reschedule, or cancel appointments as needed.
5. Update patient records and billing submissions throughout the day.
6. Send reminders or notifications.
7. Review attendance reports before closing.
8. Log out.

### Dentist

1. Log in before consultations.
2. Review today's queue and assigned appointments.
3. Open patient records before treatment.
4. Add treatment notes after each procedure.
5. Update braces progress when applicable.
6. Check attendance reports.
7. Log out.

### Patient

1. Log in to the patient portal.
2. Check upcoming appointments.
3. Book or reschedule appointments if needed.
4. Review treatment or braces progress.
5. Submit payment proof when paying online.
6. Read clinic announcements.
7. Log out, especially on shared devices.

## 13. Support and Maintenance Notes

For technical setup and maintenance, refer to:

- `README.md`
- `docs/production-readiness.md`
- `docs/shared-device-sync.md`
- `docs/vercel-railway-deployment.md`

For database setup:

1. Import `database/schema.sql`.
2. Run `php database/migrate.php`.
3. Bootstrap staff accounts using `database/bootstrap_staff.php`.
4. Configure `.env.local` or server environment variables.

