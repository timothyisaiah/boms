export const required = value =>
  (value !== null && value !== undefined && String(value).trim() !== '') ||
  'This field is required.'
export const positive = value =>
  (required(value) === true &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0) ||
  'Enter a number greater than zero.'
export const nonnegative = value =>
  (required(value) === true &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0) ||
  'Enter zero or a positive number.'
export const whole = value =>
  value === '' || Number.isInteger(Number(value)) || 'Enter a whole number.'
