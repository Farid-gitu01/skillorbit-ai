import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, Badge, Button, Card, Skeleton } from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { notificationService } from '@/services/notification.service';
import type { Notification } from '@/types/notification.types';
import { formatDate } from '@/utils/job-helpers';

const TYPE_META: Record<string, { label: string; variant: 'primary' | 'success' | 'info' | 'default' }> = {
  application_submitted: { label: 'New Application', variant: 'primary' },
  application_status_changed: { label: 'Application Update', variant: 'info' },
  job_posted: { label: 'Job Published', variant: 'success' },
  system: { label: 'Job & System Update', variant: 'default' },
};

export function EmployerNotificationsPage() {
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-surface-white">Employer Notifications</h1>
            {unreadCount > 0 && <Badge variant="primary">{unreadCount} unread</Badge>}
          </div>
          <p className="text-sm text-muted-slate mt-1">
            Stay informed on new candidate applications, withdrawals, and job posting status changes.
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
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              isLoading={isMarkingAll}
              onClick={() => void handleMarkAllAsRead()}
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`px-3.5 py-1.5 rounded-btn text-sm font-medium border transition-colors ${
            filterMode === 'all'
              ? 'bg-brand-blue/20 text-brand-cyan border-brand-blue/40'
              : 'bg-navy border-navy-surface text-muted-slate hover:text-surface-white'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('unread')}
          className={`px-3.5 py-1.5 rounded-btn text-sm font-medium border transition-colors ${
            filterMode === 'unread'
              ? 'bg-brand-blue/20 text-brand-cyan border-brand-blue/40'
              : 'bg-navy border-navy-surface text-muted-slate hover:text-surface-white'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Bell className="w-12 h-12 text-muted-slate/50 mx-auto" />
          <h2 className="text-lg font-semibold text-surface-white">
            {filterMode === 'unread' ? 'You are all caught up' : 'No notifications yet'}
          </h2>
          <p className="text-sm text-muted-slate max-w-md mx-auto">
            {filterMode === 'unread'
              ? 'Every employer alert has been reviewed.'
              : 'Notifications for incoming applications and job lifecycle changes will appear here.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => {
            const typeBadge = TYPE_META[item.type] ?? {
              label: 'Notification',
              variant: 'default' as const,
            };

            return (
              <Card
                key={item._id}
                className={`p-4 transition-colors ${
                  item.read ? '' : 'border-brand-blue/40 bg-brand-blue/5'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!item.read && (
                        <span
                          className="w-2 h-2 rounded-full bg-brand-cyan shrink-0"
                          aria-label="Unread notification"
                        />
                      )}
                      <h3 className="text-sm font-semibold text-surface-white">{item.title}</h3>
                      <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
                      <span className="text-xs text-muted-slate">{formatDate(item.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-slate">{item.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.link && (
                      <Link to={item.link}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </Link>
                    )}
                    {!item.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={busyId === item._id}
                        onClick={() => void handleMarkAsRead(item._id)}
                      >
                        Mark read
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
