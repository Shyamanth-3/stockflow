export const maxInt = 2147483647

export function isValidText(value, maxLength) {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    value.isWellFormed() &&
    !value.includes('\0')
  )
}

export function parseWholeNumber(value) {
  const number =
    typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value
  return Number.isInteger(number) && number >= 0 && number <= maxInt ? number : null
}
