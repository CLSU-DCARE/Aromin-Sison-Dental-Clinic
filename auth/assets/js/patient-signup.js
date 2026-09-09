/**
 * Patient Registration: Aromin-Sison Dental Clinic System.
 * Delegates to ASDC.AuthApiClient and ASDC.FormValidator.
 */

(function () {
  'use strict';

  function patientRegistrationError(response, payload) {
    if (response.status === 409)
      return payload.error || 'An account already uses this email address.';
    if (response.status === 400)
      return payload.error || 'Please check the information you entered.';
    if (response.status >= 500)
      return 'The clinic server is unavailable right now. Please try again shortly.';
    return payload.error || 'Unable to create your account. Please try again.';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('panel-patient-signup');
    if (!form) return;

    const button = form.querySelector('.btn-block');
    const successBox = document.getElementById('signupSuccess');
    const FV = ASDC.FormValidator;
    const API = ASDC.AuthApiClient;
    const Alert = ASDC.AlertManager;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!FV.validateForm(form)) return;

      Alert.hide();
      Alert.setLoading(button, true);

      const data = new FormData(form);
      const registration = {
        first_name: String(data.get('first_name') || '').trim(),
        last_name: String(data.get('last_name') || '').trim(),
        contact_number: String(data.get('contact_number') || '').trim(),
        email: String(data.get('email') || '').trim(),
        password: String(data.get('password') || ''),
      };

      try {
        const { response, payload } = await API.register(registration);

        if (!response.ok) {
          Alert.show(patientRegistrationError(response, payload));
          return;
        }

        form.hidden = true;
        if (successBox) {
          successBox.hidden = false;
          successBox.focus();
        }
      } catch (error) {
        Alert.show(
          API.connectionError(API.isAbortError(error))
        );
      } finally {
        Alert.setLoading(button, false);
      }
    });
  });
})();
