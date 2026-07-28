/** Shared multipart/form-data helpers for image upload requests. */

/** Strip Content-Type so the browser sets the multipart boundary. */
export function multipartRequestConfig() {
  return {
    transformRequest: [
      (data: unknown, headers: Record<string, unknown>) => {
        if (data instanceof FormData) {
          delete headers['Content-Type']
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
