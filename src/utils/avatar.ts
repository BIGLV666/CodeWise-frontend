const AVATAR_GATEWAY_PREFIX = '/uploads'

export const normalizeAvatarUrl = (url?: string | null) => {
  if (!url) return ''

  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^(https?:)?\/\//.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }

  if (trimmed.startsWith(AVATAR_GATEWAY_PREFIX)) {
    return trimmed
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
