export type ParseStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ParsedResumeData {
  extractedSkills?: string[];
  yearsOfExperience?: number;
  educationLevel?: string;
  summary?: string;
}

export interface Resume {
  _id: string;
  user: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isPrimary: boolean;
  parseStatus: ParseStatus;
  parsedData?: ParsedResumeData;
  parsedAt?: string;
  createdAt: string;
  updatedAt: string;
}
