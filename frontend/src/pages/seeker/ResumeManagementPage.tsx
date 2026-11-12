import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { resumeService } from '@/services';
import type { Resume } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui';
import { formatDate, formatFileSize } from '@/utils/job-helpers';
import {
  CheckCircle2,
  Download,
  FileText,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function ResumeManagementPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadResumes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await resumeService.getMyResumes();
      setResumes(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load resumes';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await resumeService.getMyResumes();
        if (active) {
          setResumes(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to load resumes';
          setError(msg);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMsg(null);

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError('Invalid file format. Please upload a PDF, DOC, or DOCX file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File size exceeds the 5MB limit. Please compress or choose a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const isPrimary = resumes.length === 0;
      const newResume = await resumeService.uploadResume(file, isPrimary, (percent) => {
        setUploadProgress(percent);
      });
      setResumes((prev) => [newResume, ...prev]);
      setSuccessMsg(`"${newResume.fileName}" uploaded successfully.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Resume upload failed.';
      setError(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (resume: Resume) => {
    setError(null);
    try {
      await resumeService.downloadResume(resume._id, resume.fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setError(msg);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await resumeService.setPrimaryResume(id);
      setResumes((prev) =>
        prev.map((r) => ({
          ...r,
          isPrimary: r._id === id,
        }))
      );
      setSuccessMsg('Primary resume updated.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to set primary resume';
      setError(msg);
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await resumeService.deleteResume(id);
      const updated = resumes.filter((r) => r._id !== id);
      setResumes(updated);
      setSuccessMsg(`"${fileName}" deleted.`);
      if (updated.length > 0 && !updated.some((r) => r.isPrimary)) {
        void loadResumes();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to delete resume';
      setError(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-white">Resume Management</h1>
        <p className="text-xs text-muted-slate">
          Upload, verify, and manage your resumes for instant job applications
        </p>
      </div>

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success" title="Success">
          {successMsg}
        </Alert>
      )}

      {/* Upload Box */}
      <Card className="border-dashed border-2 border-brand-blue/40 bg-navy/40">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-brand-blue/15 text-brand-cyan flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-surface-white">
              Upload a new resume
            </h3>
            <p className="text-xs text-muted-slate">
              Accepted formats: PDF, DOC, DOCX • Maximum size: 5MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="hidden"
            id="resume-file-upload"
            disabled={isUploading}
          />

          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isUploading ? `Uploading (${uploadProgress}%)` : 'Select File'}</span>
          </Button>

          {isUploading && (
            <div className="w-full max-w-sm space-y-1">
              <div className="w-full h-2 rounded-full bg-navy-surface overflow-hidden">
                <div
                  className="h-full bg-brand-cyan transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-slate">{uploadProgress}% uploaded</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Resumes List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Uploaded Resumes ({resumes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {resumes.length === 0 ? (
            <div className="py-10 text-center space-y-2 border border-dashed border-navy-surface rounded-lg">
              <FileText className="w-8 h-8 text-muted-slate mx-auto opacity-50" />
              <p className="text-xs text-muted-slate">
                You haven&apos;t uploaded any resumes yet. Upload your CV above to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-navy-surface">
              {resumes.map((resume) => (
                <div
                  key={resume._id}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-blue/15 text-brand-blue flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-surface-white">
                          {resume.fileName}
                        </h4>
                        {resume.isPrimary && (
                          <Badge variant="success">
                            <Star className="w-3 h-3 fill-current" />
                            <span>Primary</span>
                          </Badge>
                        )}
                        <Badge variant="info">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="capitalize">{resume.parseStatus}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-slate">
                        {formatFileSize(resume.fileSize)} • Uploaded {formatDate(resume.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!resume.isPrimary && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(resume._id)}
                      >
                        Set as Primary
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(resume)}
                      className="gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(resume._id, resume.fileName)}
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      aria-label={`Delete ${resume.fileName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ResumeManagementPage;
