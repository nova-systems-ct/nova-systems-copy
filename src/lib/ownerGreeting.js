// Display names are profile data only; they never grant permissions.
export function ownerFirstName(value) {
  const fullName = (typeof value === 'string' ? value : '').trim()
  const placeholder = !fullName || /^(local test|test)\b/i.test(fullName)
  return placeholder ? '' : fullName.split(' ')[0]
}
