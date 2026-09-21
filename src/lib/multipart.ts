/** Shared multipart/form-data helpers for image upload requests. */

type MultipartHeaderBag = {
  delete?: (name: string) => unknown
  [key: string]: unknown
}

/**
 * Axios 1.x JSON-stringifies FormData when Content-Type is application/json
 * (`formDataToJSON`). That collapses repeated list keys (cuisines/amenities)
 * into strings and is the ListField "got type str" 400. Strip the JSON type
 * so the adapter sends real multipart. AxiosHeaders.delete must be used —
 * `delete headers['Content-Type']` does not clear the AxiosHeaders map.
 */
export function stripJsonContentType(headers: MultipartHeaderBag | undefined) {
  if (!headers) return
  if (typeof headers.delete === 'function') {
    headers.delete('Content-Type')
    headers.delete('content-type')
  }
  delete headers['Content-Type']
  delete headers['content-type']
}

/** Strip JSON Content-Type so the browser sets the multipart boundary. */
export function multipartRequestConfig() {
  return {
    /** Instance default is 15s; branch images ride on the create POST. */
    timeout: 180_000,
    transformRequest: [
      (data: unknown, headers: MultipartHeaderBag) => {
        if (data instanceof FormData) {
          stripJsonContentType(headers)
        }
        return data
      },
    ],
  }
}

export function appendImageField(
  form: FormData,
  fieldName: string,
  image?: File,
  removeImage?: boolean,
) {
  if (image instanceof File) {
    form.append(fieldName, image)
  } else if (removeImage) {
    form.append(fieldName, '')
  }
}

/** Mock-mode preview URL when a File was selected for upload. */
export function mockImageUrlFromFile(file?: File, fallback = ''): string {
  if (file instanceof File && typeof URL !== 'undefined' && URL.createObjectURL) {
    return URL.createObjectURL(file)
  }
  return fallback
}
