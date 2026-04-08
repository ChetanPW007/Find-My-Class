import { useState, useEffect, useRef, useCallback } from 'react';
import { getScheduleCheck, updateClassroomStatus, createNotification } from '../api';
import './ScheduleMonitor.css';

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

/**
 * ScheduleMonitor
 * - Mounts inside TeacherDashboard
 * - Polls /api/timetable/schedule-check every 60s
 * - Shows notification bell + dropdown
 * - Auto-frees classroom when class ends
 * - Sends warning 5 min before end
 */
export default function ScheduleMonitor({ onClassroomFreed }) {
  const [notifications, setNotifications] = useState([]); // { id, type, message, seen }
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [activeToast, setActiveToast] = useState(null); // The most recent floating alert
  const sentWarnings = useRef(new Set());   // Set of "day-slot" keys already warned
  const sentEnded  = useRef(new Set());    // Set of "day-slot" keys already ended
  const panelRef = useRef(null);

  const unreads = notifications.filter(n => !n.seen).length;

  const addNotification = useCallback((notif) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [{ ...notif, id, seen: false }, ...prev].slice(0, 20));
    
    // Aesthetic Floating Toast
    setActiveToast({ ...notif, id });
    setTimeout(() => setActiveToast(prev => prev?.id === id ? null : prev), 6000);

    // Native Browser Notification (Support for Desktop & Android)
    const title = `FindMyClass: ${notif.type === 'warning' ? '⚠️ Warning' : '🔴 Ended'}`;
    const options = {
      body: notif.message,
      icon: '/icons.svg',
      badge: '/favicon.svg',
      tag: 'schedule-alert', // Prevents flooding
      vibrate: [200, 100, 200], // Vibration for Android
    };

    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, options);
      });
    } else if (Notification.permission === 'granted') {
      new Notification(title, options);
    }

    return id;
  }, []);

  const checkSchedule = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await getScheduleCheck();
      const { ongoing, warning, ended } = res.data;

      // ── Warning (5 min before end)
      for (const cls of (warning || [])) {
        const key = `${cls.day}-${cls.slot}`;
        if (!sentWarnings.current.has(key)) {
          sentWarnings.current.add(key);
          const msg = `⚠️ "${cls.subject}" ends in ~${cls.mins_to_end} min (${cls.end_time}). Room: ${cls.classroom || 'check timetable'}`;
          addNotification({ type: 'warning', message: msg, subject: cls.subject });

          // Persist to backend
          createNotification({
            username: localStorage.getItem('username') || '',
            type: 'warning',
            message: msg,
            subject: cls.subject,
            classroom: cls.classroom || '',
          }).catch(() => {});
        }
      }

      // ── Class ended → auto-free classroom
      for (const cls of (ended || [])) {
        const key = `${cls.day}-${cls.slot}`;
        if (!sentEnded.current.has(key)) {
          sentEnded.current.add(key);
          const msg = `🔴 "${cls.subject}" class has ended (${cls.end_time}). Room auto-freed.`;
          addNotification({ type: 'ended', message: msg, subject: cls.subject });

          // Auto-free: call classroom status API if classroom known
          if (cls.classroom) {
            onClassroomFreed && onClassroomFreed(cls);
          }

          // Persist notification
          createNotification({
            username: localStorage.getItem('username') || '',
            type: 'ended',
            message: msg,
            subject: cls.subject,
            classroom: cls.classroom || '',
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[ScheduleMonitor] check failed:', e.message);
    }
    setChecking(false);
  }, [checking, addNotification, onClassroomFreed]);

  // Poll on mount and every POLL_INTERVAL_MS
  useEffect(() => {
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Reset tracking on mount
    sentWarnings.current = new Set();
    sentEnded.current    = new Set();

    checkSchedule();
    const interval = setInterval(checkSchedule, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllSeen = () => {
    setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
  };

  const dismissAll = () => {
    setNotifications([]);
    setOpen(false);
  };

  return (
    <div className="sm-wrapper" ref={panelRef}>
      {/* Bell Button */}
      <button
        className={`sm-bell ${unreads > 0 ? 'sm-bell-active' : ''}`}
        onClick={() => { setOpen(o => !o); if (!open) markAllSeen(); }}
        title="Schedule Notifications"
      >
        🔔
        {unreads > 0 && <span className="sm-badge">{unreads}</span>}
        {checking && <span className="sm-pulse" />}
      </button>

      {/* Notification Panel */}
      {open && (
        <div className="sm-panel animate-slide-down">
          <div className="sm-panel-header">
            <span>📅 Schedule Alerts</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="sm-action-btn" onClick={() => addNotification({ type: 'warning', message: 'This is a test notification! It works! 🚀' })}>
                Send Test
              </button>
              <button className="sm-action-btn" onClick={dismissAll}>Clear all</button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="sm-empty">
              <span>✅</span>
              <p>No alerts. Checking every minute.</p>
            </div>
          ) : (
            <div className="sm-list">
              {notifications.map(n => (
                <div key={n.id} className={`sm-item sm-item-${n.type}`}>
                  <span className="sm-item-icon">
                    {n.type === 'warning' ? '⚠️' : n.type === 'ended' ? '🔴' : 'ℹ️'}
                  </span>
                  <div className="sm-item-body">
                    <p className="sm-item-msg">{n.message}</p>
                    <span className="sm-item-time">{new Date().toLocaleTimeString()}</span>
                  </div>
                  <button
                    className="sm-dismiss"
                    onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="sm-footer">
            Polling every 60s · Last check: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Floating Aesthetic Toast */}
      {activeToast && (
        <div className={`sm-floating-toast sm-item-${activeToast.type} animate-glass-slide-up`}>
          <span className="sm-item-icon">
            {activeToast.type === 'warning' ? '⚠️' : '🔴'}
          </span>
          <div className="sm-item-body">
            <p className="sm-item-msg">{activeToast.message}</p>
          </div>
          <button className="sm-dismiss" onClick={() => setActiveToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}
