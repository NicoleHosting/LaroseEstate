export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assert(condition, status, code, message, details) {
  if (!condition) throw new AppError(status, code, message, details);
}

export function cleanText(value, { name = 'value', min = 1, max = 200 } = {}) {
  assert(typeof value === 'string', 400, 'INVALID_INPUT', `${name} must be text.`);
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  assert(clean.length >= min && clean.length <= max, 400, 'INVALID_INPUT', `${name} must be ${min}-${max} characters.`);
  return clean;
}

export function optionalText(value, options = {}) {
  if (value === undefined || value === null || value === '') return null;
  return cleanText(value, options);
}

export function asInteger(value, { name = 'value', min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  assert(Number.isSafeInteger(parsed) && parsed >= min && parsed <= max, 400, 'INVALID_INPUT', `${name} must be an integer from ${min} to ${max}.`);
  return parsed;
}
