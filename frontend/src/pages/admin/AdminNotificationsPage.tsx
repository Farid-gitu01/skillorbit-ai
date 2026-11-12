import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, Skeleton } from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { notificationService } from '@/services/notification.service';
import type { Notification } from '@/types/notification.types';
import { formatAdminTimestamp } from '@/utils/admin-validation';

export function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
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
        prev.map((item) => (item._id === id ? { ...item, read: true } : item))
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
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const visibleItems =
    filterMode === 'unread' ? notifications.filter((item) => !item.read) : notifications;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-white">Admin Notifications</h1>
          <p className="text-xs text-muted-slate mt-1">
            Platform alerts and administrative updates ({unreadCount} unread).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadNotifications}
            disabled={isLoading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              size="sm"
              onClick={handleMarkAllAsRead}
              isLoading={isMarkingAll}
              className="gap-1.5 text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filterMode === 'all' ? 'primary' : 'outline'}
          onClick={() => setFilterMode('all')}
        >
          All ({notifications.length})
        </Button>
        <Button
          size="sm"
          variant={filterMode === 'unread' ? 'primary' : 'outline'}
          onClick={() => setFilterMode('unread')}
        >
          Unread ({unreadCount})
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Bell className="w-8 h-8 text-muted-slate mx-auto" />
            <p className="text-sm font-semibold text-surface-white">
              {filterMode === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-xs text-muted-slate">
              Administrative system alerts and platform updates will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((notif) => (
            <Card
              key={notif._id}
              className={notif.read ? 'opacity-80' : 'border-brand-blue/40 bg-navy/90'}
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-surface-white">
                      {notif.title}
                    </span>
                    <Badge variant={notif.read ? 'default' : 'primary'}>
                      {notif.read ? 'Read' : 'Unread'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-slate">{notif.message}</p>
                  <p className="text-[10px] text-muted-slate">
                    {formatAdminTimestamp(notif.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {notif.link && (
                    <Link to={notif.link}>
                      <Button size="sm" variant="outline" className="gap-1 text-xs">
                        Open <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  )}
                  {!notif.read && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={busyId === notif._id}
                      onClick={() => handleMarkAsRead(notif._id)}
                      className="text-xs"
                    >
                      Mark Read
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
