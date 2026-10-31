/** An error that is safe to show to API clients. */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new AppError(400, code, message, details);
export const notFound = (message = 'Not found.') => new AppError(404, 'not_found', message);
export const conflict = (code, message, details) => new AppError(409, code, message, details);
export const unauthorized = (message = 'Please sign in.') =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have permission to do this.') =>
  new AppError(403, 'forbidden', message);
export const unavailable = (code, message) => new AppError(503, code, message);
