export type BunnyUploadInput = {
  path: string
  body: BodyInit
  contentType?: string
}

export type BunnyStorageConfig = {
  storageZone: string
  region: string
  accessKey: string
  cdnBaseUrl: string
}

export function getBunnyConfig(): BunnyStorageConfig {
  const storageZone = process.env.BUNNY_STORAGE_ZONE
  const region = process.env.BUNNY_STORAGE_REGION ?? 'sg'
  const accessKey = process.env.BUNNY_STORAGE_ACCESS_KEY
  const cdnBaseUrl = process.env.BUNNY_CDN_BASE_URL

  if (!storageZone || !accessKey || !cdnBaseUrl) {
    throw new Error('Bunny storage requires BUNNY_STORAGE_ZONE, BUNNY_STORAGE_ACCESS_KEY, and BUNNY_CDN_BASE_URL.')
  }

  return { storageZone, region, accessKey, cdnBaseUrl }
}

export async function uploadToBunny(input: BunnyUploadInput, config = getBunnyConfig()) {
  const normalizedPath = input.path.replace(/^\/+/, '')
  const endpoint = `https://${config.region}.storage.bunnycdn.com/${config.storageZone}/${normalizedPath}`

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      AccessKey: config.accessKey,
      ...(input.contentType ? { 'Content-Type': input.contentType } : {}),
    },
    body: input.body,
  })

  if (!response.ok) {
    throw new Error(`Bunny upload failed with ${response.status}: ${await response.text()}`)
  }

  return {
    path: normalizedPath,
    publicUrl: `${config.cdnBaseUrl.replace(/\/+$/, '')}/${normalizedPath}`,
  }
}
