UPDATE notification_templates
   SET body = 'Hi {patient_name}, your recent payment submission of {amount} could not be verified and was rejected. Reason: {reason}. Please check your receipt and resubmit, or contact us for help. - Aromin-Sison Dental Clinic'
 WHERE template_key = 'payment_rejected';
