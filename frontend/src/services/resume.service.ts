import { api } from './api';
import type { ApiResponse } from '@/types/api.types';
import type { Resume } from '@/types/resume.types';

export const resumeService = {
  async getMyResumes(): Promise<Resume[]> {
    const response = await api.get<ApiResponse<{ resumes: Resume[] }>>('/resumes/me');
    return response.data.data.resumes;
  },

  async uploadResume(
    file: File,
    isPrimary = false,
    onProgress?: (percent: number) => void
  ): Promise<Resume> {
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('isPrimary', String(isPrimary));

    const response = await api.post<ApiResponse<{ resume: Resume }>>('/resumes/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return response.data.data.resume;
  },

  async downloadResume(id: string, fileName: string): Promise<void> {
    const response = await api.get<Blob>(`/resumes/${id}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async deleteResume(id: string): Promise<void> {
    await api.delete(`/resumes/${id}`);
  },

  async setPrimaryResume(id: string): Promise<Resume> {
    const response = await api.patch<ApiResponse<{ resume: Resume }>>(`/resumes/${id}/primary`);
    return response.data.data.resume;
  },
};
