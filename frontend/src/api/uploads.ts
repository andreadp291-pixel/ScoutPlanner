import { apiUpload, resolveApiUrl } from './client'

export interface UploadResult {
  url: string
  filename: string
  kind: 'image'
}

export async function uploadFile(projectId: number, file: File): Promise<UploadResult> {
  const result = await apiUpload<UploadResult>(`/projects/${projectId}/uploads`, file, projectId)
  return { ...result, url: resolveApiUrl(result.url) }
}
