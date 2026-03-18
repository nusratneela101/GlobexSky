/**
 * SMS service placeholder.
 * Integrate Twilio, Vonage, or similar provider here.
 */

export async function sendSMS(to, message) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SMS] To: ${to} | Message: ${message}`);
    return { success: true, mock: true };
  }
  // TODO: implement real SMS provider
  throw new Error('SMS provider not configured.');
}

export async function sendOTP(to, otp) {
  return sendSMS(to, `Your GlobexSky verification code is: ${otp}. Valid for 10 minutes.`);
}
