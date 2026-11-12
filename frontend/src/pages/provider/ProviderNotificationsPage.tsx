import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, Badge, Button, Card, Skeleton } from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { notificationService } from '@/services/notification.service';
import type { Notification } from '@/types/notification.types';
import { formatDate } from '@/utils/job-helpers';

const TYPE_META: Record<
  string,
  { label: string; variant: 'primary' | 'success' | 'info' | 'purple' | 'default' }
> = {
  course_enrollment: { label: 'Learner Engagement', variant: 'primary' },
  course_completed: { label: 'Course Completed', variant: 'success' },
  roadmap_updated: { label: 'Roadmap Update', variant: 'purple' },
  admin_action: { label: 'Verification & Account', variant: 'info' },
  system: { label: 'Platform Notice', variant: 'default' },
};

export function ProviderNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getMyNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
      setError(null);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await notificationService.getMyNotifications();
        if (active) {
          setNotifications(res.notifications);
          setUnreadCount(res.unreadCount);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(normalizeApiError(err).message);
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

  const handleMarkAsRead = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    setError(null);
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const visibleItems =
    filterMode === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white flex items-center gap-2">
            Provider Notifications
            {unreadCount > 0 && <Badge variant="primary">{unreadCount} unread</Badge>}
          </h1>
          <p className="text-xs text-muted-slate mt-1">
            Stay up to date on new course enrollments, learner enquiries, and platform verification alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              void loadNotifications();
            }}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleMarkAllAsRead()}
              disabled={isMarkingAll}
              className="gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-navy-surface pb-3">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-colors ${
            filterMode === 'all'
              ? 'bg-brand-blue text-white'
              : 'text-muted-slate hover:text-surface-white hover:bg-navy-surface'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('unread')}
          className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-colors ${
            filterMode === 'unread'
              ? 'bg-brand-blue text-white'
              : 'text-muted-slate hover:text-surface-white hover:bg-navy-surface'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <Card>
          <div className="p-10 text-center space-y-2">
            <Bell className="w-9 h-9 text-muted-slate mx-auto opacity-70" />
            <p className="text-sm font-medium text-surface-white">
              {filterMode === 'unread'
                ? 'No unread notifications'
                : 'Your notification inbox is empty'}
            </p>
            <p className="text-xs text-muted-slate max-w-sm mx-auto">
              {filterMode === 'unread'
                ? 'You have caught up on all learner enrollments and system messages.'
                : 'Notifications will appear here when seekers enroll or enquire about your offerings.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((notif) => {
            const typeMeta = TYPE_META[notif.type] ?? {
              label: 'Notification',
              variant: 'default' as const,
            };
            return (
              <Card
                key={notif._id}
                className={!notif.read ? 'border-brand-blue/40 bg-navy/95' : ''}
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-brand-cyan shrink-0" />
                      )}
                      <h3 className="text-sm font-semibold text-surface-white">{notif.title}</h3>
                      <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                    </div>
                    {notif.message && (
                      <p className="text-xs text-muted-slate leading-relaxed">{notif.message}</p>
                    )}
                    <p className="text-[11px] text-muted-slate">{formatDate(notif.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {notif.link && (
                      <Link to={notif.link}>
                        <Button variant="outline" size="sm" className="text-xs gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </Button>
                      </Link>
                    )}
                    {!notif.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === notif._id}
                        onClick={() => void handleMarkAsRead(notif._id)}
                        className="text-xs"
                      >
                        Mark Read
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
