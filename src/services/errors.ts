export class ServiceError extends Error {
  constructor(public readonly kind: 'auth' | 'network' | 'permission' | 'validation' | 'database', message: string) {
    super(message);
  }
}
export function safeError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  const value = error as { code?: string; status?: number; name?: string; message?: string } | null;
  if (value?.code === 'email_address_invalid') return new ServiceError('validation', 'Enter a real email address that can receive a confirmation message.');
  if (value?.code === 'email_address_not_authorized') return new ServiceError('validation', 'This project’s email service cannot send to this address yet. Configure SMTP or use an authorized test address.');
  if (value?.code === 'weak_password') return new ServiceError('validation', 'Choose a stronger password with at least 12 characters.');
  if (value?.code === 'over_email_send_rate_limit') return new ServiceError('network', 'The email sending limit has been reached. Wait before requesting another confirmation email.');
  if (value?.status === 401 || ['PGRST301', 'PGRST302', 'PGRST303', 'bad_jwt', 'user_not_found', 'session_not_found', 'refresh_token_not_found'].includes(value?.code ?? '')) {
    return new ServiceError('auth', 'Your session could not be verified. Sign in again.');
  }
  if (value?.status === 429 || value?.code === 'over_request_rate_limit') return new ServiceError('network', 'Too many requests. Please wait before trying again.');
  if (value?.code === '42501' || value?.status === 403) return new ServiceError('permission', 'You do not have permission to access this record.');
  if (['23514', '23503', '23502', '22P02'].includes(value?.code ?? '')) return new ServiceError('validation', 'Check your input and linked records, then try again.');
  if (value?.code === '23505') return new ServiceError('validation', 'This record already exists.');
  if (error instanceof TypeError || ['AbortError', 'TimeoutError', 'AuthRetryableFetchError'].includes(value?.name ?? '') || (!value?.code && /failed to fetch|fetch failed|aborterror|timeouterror/i.test(value?.message ?? ''))) return new ServiceError('network', 'The service could not be reached. Check your connection and retry.');
  return new ServiceError('database', 'The request could not be completed. Retry, or check the backend configuration.');
}
