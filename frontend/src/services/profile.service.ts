import { api } from './api';
import type { ApiResponse } from '@/types/api.types';
import type { SeekerProfile, UpdateProfilePayload } from '@/types/profile.types';

export const profileService = {
  async getMyProfile(): Promise<SeekerProfile> {
    const response = await api.get<ApiResponse<{ profile: SeekerProfile }>>('/profiles/me');
    return response.data.data.profile;
  },

  async updateMyProfile(payload: UpdateProfilePayload): Promise<SeekerProfile> {
    const response = await api.put<ApiResponse<{ profile: SeekerProfile }>>('/profiles/me', payload);
    return response.data.data.profile;
  },
};
