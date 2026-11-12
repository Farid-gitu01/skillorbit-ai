import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationService } from '@/services';
import type { Notification } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
} from '@/components/ui';
import { formatDate } from '@/utils/job-helpers';
import { Bell, CheckCheck, CheckCircle2, Info } from 'lucide-react';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await notificationService.getMyNotifications();
        if (active) {
          setNotifications(result.notifications);
          setUnreadCount(result.unreadCount);
          setError(null);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to load notifications';
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

  const handleMarkAsRead = async (id: string) => {
    try {
      const updated = await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: updated.read, readAt: updated.readAt } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Handled silently
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark notifications as read';
      setError(msg);
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-surface-white">Notifications</h1>
            <p className="text-xs text-muted-slate">
              Stay updated on application reviews, matched opportunities, and platform alerts
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="primary">{unreadCount} Unread</Badge>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={isMarkingAll}
            onClick={handleMarkAllAsRead}
            className="gap-1.5"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All as Read</span>
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Bell className="w-10 h-10 text-muted-slate mx-auto opacity-40" />
            <h3 className="text-sm font-semibold text-surface-white">
              You&apos;re all caught up
            </h3>
            <p className="text-xs text-muted-slate max-w-md mx-auto">
              You have no notifications at the moment. Activity from job applications and matches will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif._id}
              className={
                notif.read
                  ? 'border-navy-surface bg-navy/40 opacity-85'
                  : 'border-brand-blue/40 bg-brand-blue/5'
              }
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      notif.read
                        ? 'bg-navy-surface text-muted-slate'
                        : 'bg-brand-blue/20 text-brand-cyan'
                    }`}
                  >
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-surface-white">
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-brand-cyan" aria-label="Unread" />
                      )}
                    </div>
                    {notif.message && (
                      <p className="text-xs text-muted-slate">{notif.message}</p>
                    )}
                    <p className="text-[11px] text-muted-slate">
                      {formatDate(notif.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {notif.link && (
                    <Link to={notif.link}>
                      <Button variant="secondary" size="sm">
                        View
                      </Button>
                    </Link>
                  )}
                  {!notif.read && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(notif._id)}
                      className="gap-1.5 text-brand-cyan"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Read</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
