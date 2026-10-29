import React, { useState, useEffect } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { NotificationItem } from '../types';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { unreadCount, refreshUser } = useAuth();

  const fetchNotes = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotes();
    }
  }, [isOpen]);

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      await refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      await refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-xl bg-white shadow-2xl border border-slate-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="font-semibold text-sm text-slate-800">Alerts & Notifications</span>
              {notifications.some((n) => !n.is_read) && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-civic-600 hover:text-civic-800 font-medium flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No notifications yet. You will receive updates when your reported issues progress.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 text-xs transition-colors ${
                      !n.is_read ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-slate-800">{n.title}</h4>
                      {!n.is_read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-slate-600 leading-relaxed">{n.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {n.link_url && (
                        <Link
                          to={n.link_url}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1 font-medium text-civic-600 hover:text-civic-800"
                        >
                          View Issue <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
