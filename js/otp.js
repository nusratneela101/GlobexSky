/**
 * js/otp.js — Email OTP authentication using Supabase built-in OTP.
 *
 * Completely FREE — Supabase handles email delivery.
 * SMS is optional and can be configured later via admin panel.
 *
 * Usage:
 *   GlobexOTP.sendEmailOTP('user@email.com')
 *   GlobexOTP.verifyEmailOTP('user@email.com', '123456')
 *   GlobexOTP.startResendCountdown(60, callback)
 */
(function (global) {
  'use strict';

  function _sb() {
    return global.supabaseClient || (global.GlobexCfg && global.GlobexCfg.getClient());
  }

  var GlobexOTP = {
    _countdownInterval: null,

    // ── Send email OTP (Supabase Magic Link / OTP) ───────────────────────────

    sendEmailOTP: async function (email) {
      var sb = _sb();
      if (!sb) throw new Error('Supabase not initialised');
      if (!email || !email.includes('@')) throw new Error('Invalid email address');

      var result = await sb.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: global.location ? global.location.origin + '/pages/auth/verify.html' : undefined
        }
      });
      if (result.error) throw result.error;
      return result;
    },

    // ── Verify OTP token ─────────────────────────────────────────────────────

    verifyEmailOTP: async function (email, token) {
      var sb = _sb();
      if (!sb) throw new Error('Supabase not initialised');
      if (!token || token.length < 6) throw new Error('Enter the 6-digit OTP code');

      var result = await sb.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email'
      });
      if (result.error) throw result.error;
      return result;
    },

    // ── Phone OTP (optional — fallback to email if SMS not configured) ───────

    sendPhoneOTP: async function (phone) {
      var sb = _sb();

      // Check if SMS provider is configured
      var settings = await sb.from('app_settings')
        .select('value')
        .eq('key', 'sms_provider')
        .single();

      var provider = settings.data && settings.data.value;
      if (!provider) {
        return {
          fallback: true,
          message: 'SMS not configured. Please use email OTP instead.'
        };
      }

      // Use Supabase phone OTP if configured
      var result = await sb.auth.signInWithOtp({ phone: phone });
      if (result.error) throw result.error;
      return result;
    },

    verifyPhoneOTP: async function (phone, token) {
      var sb = _sb();
      var result = await sb.auth.verifyOtp({
        phone: phone,
        token: token.trim(),
        type: 'sms'
      });
      if (result.error) throw result.error;
      return result;
    },

    // ── Resend countdown timer ───────────────────────────────────────────────

    startResendCountdown: function (seconds, onTick, onComplete) {
      if (this._countdownInterval) clearInterval(this._countdownInterval);
      var remaining = seconds || 60;
      if (typeof onTick === 'function') onTick(remaining);
      this._countdownInterval = setInterval(function () {
        remaining -= 1;
        if (typeof onTick === 'function') onTick(remaining);
        if (remaining <= 0) {
          clearInterval(GlobexOTP._countdownInterval);
          GlobexOTP._countdownInterval = null;
          if (typeof onComplete === 'function') onComplete();
        }
      }, 1000);
      return this._countdownInterval;
    },

    // ── Render an OTP input widget ───────────────────────────────────────────

    renderOTPInput: function (containerId, numDigits) {
      var n = numDigits || 6;
      var container = document.getElementById(containerId);
      if (!container) return;

      container.innerHTML = '';
      container.style.cssText = 'display:flex;gap:8px;justify-content:center;';

      var inputs = [];
      for (var i = 0; i < n; i++) {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.maxLength = 1;
        inp.inputMode = 'numeric';
        inp.pattern = '[0-9]';
        inp.style.cssText = 'width:44px;height:52px;text-align:center;font-size:1.4rem;font-weight:700;border:2px solid #e2e8f0;border-radius:10px;outline:none;font-family:Poppins,sans-serif;transition:border-color .2s;';
        inp.addEventListener('focus', function () { this.style.borderColor = '#0052CC'; });
        inp.addEventListener('blur', function () { this.style.borderColor = '#e2e8f0'; });
        inp.addEventListener('input', function (e) {
          var val = e.target.value.replace(/\D/g, '');
          e.target.value = val.slice(-1);
          var idx = inputs.indexOf(e.target);
          if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
          // Auto submit when all filled
          var code = inputs.map(function (x) { return x.value; }).join('');
          if (code.length === n) {
            container.dispatchEvent(new CustomEvent('otp-complete', { detail: { code: code } }));
          }
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !e.target.value) {
            var idx = inputs.indexOf(e.target);
            if (idx > 0) inputs[idx - 1].focus();
          }
        });
        inp.addEventListener('paste', function (e) {
          var paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
          inputs.forEach(function (inp, i) { inp.value = paste[i] || ''; });
          var code = inputs.map(function (x) { return x.value; }).join('');
          if (code.length === n) {
            container.dispatchEvent(new CustomEvent('otp-complete', { detail: { code: code } }));
          }
          e.preventDefault();
        });
        container.appendChild(inp);
        inputs.push(inp);
      }

      // getCode helper
      container.getOTPCode = function () {
        return inputs.map(function (x) { return x.value; }).join('');
      };
      container.clearOTP = function () {
        inputs.forEach(function (x) { x.value = ''; });
        if (inputs[0]) inputs[0].focus();
      };

      return container;
    }
  };

  global.GlobexOTP = GlobexOTP;

}(typeof window !== 'undefined' ? window : this));
