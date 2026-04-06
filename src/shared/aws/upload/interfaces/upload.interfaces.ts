export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  fileUrl: string;
}

export interface BulkPresignedUrlResponse {
  files: PresignedUrlResponse[];
}