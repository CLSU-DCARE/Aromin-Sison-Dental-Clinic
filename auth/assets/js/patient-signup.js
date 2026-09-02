const PATIENT_REGISTER_ENDPOINT = '../backend/api/auth/register.php';

function patientRegistrationError(response, payload){
  if (response.status === 409) {
    return payload.error || 'An account already uses this email address.';
  }

  if (response.status === 400) {
    return payload.error || 'Please check the information you entered.';
  }

  if (response.status >= 500) {
    return 'The clinic server is unavailable right now. Please try again shortly.';
  }

  return payload.error || 'Unable to create your account. Please try again.';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('panel-patient-signup');
  if (!form) return;

  const button = form.querySelector('.btn-block');
  const successBox = document.getElementById('signupSuccess');

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!validateForm(form)) return;

    hideAlert();
    setLoading(button, true);

    const data = new FormData(form);

    const registration = {
      first_name: String(data.get('first_name') || '').trim(),
      last_name: String(data.get('last_name') || '').trim(),
      contact_number: String(data.get('contact_number') || '').trim(),
      email: String(data.get('email') || '').trim(),
      password: String(data.get('password') || '')
    };

    try {
      const response = await fetchWithTimeout(PATIENT_REGISTER_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registration)
      });

      const payload = await readJsonResponse(response);

      if (!response.ok){
        showAlert(patientRegistrationError(response, payload));
        return;
      }

      form.hidden = true;

      if (successBox){
        successBox.hidden = false;
        successBox.focus();
      }
    } catch (error){
      showAlert(
        error && error.name === 'AbortError'
          ? 'The clinic server took too long to respond. Please try again.'
          : 'Unable to reach the clinic server. Check your connection and try again.'
      );
    } finally {
      setLoading(button, false);
    }
  });
});