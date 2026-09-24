/**
 * FormValidator: Aromin-Sison Dental Clinic System.
 * Client-side form validation with field-level errors and live validation.
 */
(function () {
  'use strict';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MOBILE_RE = /^[+0-9() .-]{7,20}$/;

  class FormValidator {
    static setFieldError(inputEl, message) {
      const group = inputEl.closest('.form-group');
      if (!group) return;
      group.classList.add('has-error');
      const err = group.querySelector('.field-error');
      if (err) {
        err.textContent = message;
        err.id = err.id || inputEl.id + '-error';
        inputEl.setAttribute('aria-invalid', 'true');
        inputEl.setAttribute('aria-describedby', err.id);
      }
    }

    static clearFieldError(inputEl) {
      const group = inputEl.closest('.form-group');
      if (group) group.classList.remove('has-error');
      inputEl.removeAttribute('aria-invalid');
      inputEl.removeAttribute('aria-describedby');
    }

    static validateField(input) {
      const value = input.value.trim();

      if (input.hasAttribute('required') && !value) {
        FormValidator.setFieldError(input, 'Please fill out this field.');
        return false;
      }
      if (input.type === 'email' && value && !EMAIL_RE.test(value)) {
        FormValidator.setFieldError(
          input,
          'Please enter a valid email address.'
        );
        return false;
      }
      if (input.hasAttribute('data-login-identifier') && value && !EMAIL_RE.test(value) && !MOBILE_RE.test(value)) {
        FormValidator.setFieldError(
          input,
          'Enter the email address or mobile number registered with the clinic.'
        );
        return false;
      }
      if (
        input.type === 'checkbox' &&
        input.hasAttribute('required') &&
        !input.checked
      ) {
        FormValidator.setFieldError(
          input,
          'You need to agree before continuing.'
        );
        return false;
      }

      FormValidator.clearFieldError(input);
      return true;
    }

    static validateForm(form) {
      const fields = form.querySelectorAll(
        'input[required], input[type="email"]'
      );
      let firstInvalid = null;
      let allValid = true;
      fields.forEach((field) => {
        const ok = FormValidator.validateField(field);
        if (!ok) {
          allValid = false;
          if (!firstInvalid) firstInvalid = field;
        }
      });
      if (firstInvalid) firstInvalid.focus();
      return allValid;
    }

    static initLiveValidation(container) {
      const root = container || document;
      root.querySelectorAll('.auth-panel input').forEach((input) => {
        input.addEventListener('blur', () => {
          if (input.value.trim()) FormValidator.validateField(input);
        });
        input.addEventListener('input', () => {
          const group = input.closest('.form-group');
          if (group && group.classList.contains('has-error'))
            FormValidator.validateField(input);
        });
      });
    }
  }

  window.ASDC.FormValidator = FormValidator;
})();
