export type NotificationType =
  | 'application_submitted'
  | 'application_status_changed'
  | 'job_match'
  | 'job_posted'
  | 'course_enrollment'
  | 'course_completed'
  | 'assessment_result'
  | 'roadmap_updated'
  | 'system'
  | 'admin_action';

export interface Notification {
  _id: string;
  recipient: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}
