export const SECURITY = {
  MAX_RECURSION_DEPTH: 5,
  FETCH_TIMEOUT_MS: 15_000,
  MAX_PACKAGES_PER_CHECK: 200,
  MAX_PACKAGE_NAME_LENGTH: 214,
  ALLOWED_REGISTRY_PROTOCOLS: ['https:', 'http:'],
  BLOCKED_HOSTS: [
    '169.254.169.254',
    'metadata.google.internal',
    '100.100.100.200',
    'metadata',
  ],
  BLOCKED_NETWORKS: [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^0\./,
    /^169\.254\./,
  ],
  PACKAGE_NAME_PATTERN: /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/,
}

export function validateRegistry(url: string): string | Error {
  if (!url) return ''

  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return new Error(`Invalid registry URL: ${url}`)
  }

  if (!SECURITY.ALLOWED_REGISTRY_PROTOCOLS.includes(parsed.protocol)) {
    return new Error(`Registry URL must use http or https protocol, got ${parsed.protocol}`)
  }

  const hostname = parsed.hostname.toLowerCase()
  for (const blocked of SECURITY.BLOCKED_HOSTS) {
    if (hostname === blocked) {
      return new Error('Registry URL points to a blocked host')
    }
  }

  for (const network of SECURITY.BLOCKED_NETWORKS) {
    if (network.test(hostname)) {
      return new Error('Registry URL points to a private or reserved network')
    }
  }

  return url
}

export function validatePackageName(name: string): string | Error {
  if (!name || typeof name !== 'string') {
    return new Error('Package name is required')
  }

  if (name.length > SECURITY.MAX_PACKAGE_NAME_LENGTH) {
    return new Error(`Package name exceeds maximum length of ${SECURITY.MAX_PACKAGE_NAME_LENGTH}`)
  }

  if (name.includes('..') || name.includes('\0')) {
    return new Error('Package name contains invalid characters')
  }

  if (!SECURITY.PACKAGE_NAME_PATTERN.test(name)) {
    return new Error(`Invalid package name: ${name}`)
  }

  return name
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        reject(new Error(`Operation timed out after ${ms}ms`))
      })
    }),
  ]).finally(() => clearTimeout(timeout))
}

export function createSafeFetch(defaults: { timeout: number }): (url: string) => Promise<Response> {
  return async (url: string) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    }
    catch {
      throw new Error(`Invalid fetch URL: ${url}`)
    }

    if (!SECURITY.ALLOWED_REGISTRY_PROTOCOLS.includes(parsed.protocol)) {
      throw new Error(`Fetch URL must use http or https protocol, got ${parsed.protocol}`)
    }

    const hostname = parsed.hostname.toLowerCase()
    for (const blocked of SECURITY.BLOCKED_HOSTS) {
      if (hostname === blocked) {
        throw new Error('Fetch URL points to a blocked host')
      }
    }

    for (const network of SECURITY.BLOCKED_NETWORKS) {
      if (network.test(hostname)) {
        throw new Error('Fetch URL points to a private or reserved network')
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), defaults.timeout)

    try {
      return await fetch(url, { signal: controller.signal })
    }
    finally {
      clearTimeout(timeout)
    }
  }
}

export function withPackageLimit(deps: Record<string, unknown>): Record<string, unknown> | Error {
  if (Object.keys(deps).length > SECURITY.MAX_PACKAGES_PER_CHECK) {
    return new Error(`Too many packages to check (max ${SECURITY.MAX_PACKAGES_PER_CHECK})`)
  }
  return deps
}

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    let message = error.message

    message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[redacted-ip]')
    message = message.replace(/(?:\/[\w.-]+){2,}/g, (match) => {
      if (match.startsWith('/node_modules') || match.startsWith('/npm')) return match
      return '[redacted-path]'
    })

    return message
  }

  return String(error)
}

export function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }, null, 2) }] }
}
