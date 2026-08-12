import React, { useEffect, useState } from 'react';
import { Send, Users, ShieldAlert, History, MailCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../components/Toaster.jsx';
import Button from '../../components/Button.jsx';
import Field from '../../components/Field.jsx';

export default function AdminBroadcast() {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filter, setFilter] = useState('all');
  const [sending, setSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await api.get('/admin/broadcasts');
      setBroadcasts(res.broadcasts || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast('Subject and email content are required', 'warning');
      return;
    }

    if (!window.confirm('Are you sure you want to send this broadcast email to selected users?')) {
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/admin/broadcast', {
        subject: subject.trim(),
        body: body.trim(),
        recipientFilter: filter,
      });

      toast(res.message || 'Broadcast sent successfully!', 'success');
      setSubject('');
      setBody('');
      loadHistory();
    } catch (err) {
      toast(err.message || 'Failed to send broadcast', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-display font-bold text-ink flex items-center gap-2.5">
          <Send size={24} className="text-accent" /> Email Broadcast Center
        </h1>
        <p className="text-ink-muted mt-1 text-sm">
          Send campus announcements, platform updates, or promotional emails to registered users.
        </p>
      </header>

      {/* Broadcast Composer */}
      <form onSubmit={handleSend} className="card p-6 space-y-5">
        <h3 className="font-display font-semibold text-ink text-base">Compose Broadcast Message</h3>

        <div className="space-y-4">
          <div>
            <label className="field-label block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Recipient Group
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { value: 'all', label: 'All Active Users' },
                { value: 'users', label: 'Customers Only' },
                { value: 'admins', label: 'Staff & Admins Only' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    filter === opt.value
                      ? 'border-accent bg-accent-soft text-accent ring-2 ring-accent/20'
                      : 'border-line bg-white hover:bg-slate-50 text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Field
            label="Email Subject"
            type="text"
            placeholder="e.g. New Exam Season Offer — 20% off all spiral binding!"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <div>
            <label className="field-label block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Email Content (HTML supported)
            </label>
            <textarea
              rows={8}
              placeholder="Write your email announcement here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="field-input font-mono text-xs w-full leading-relaxed p-3"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-line">
          <p className="text-[11px] text-ink-muted flex items-center gap-1">
            <ShieldAlert size={14} className="text-amber-500" /> Automatically respects user email preferences &amp; unsubscribe requests.
          </p>
          <Button type="submit" loading={sending} loadingText="Sending Broadcast…">
            <Send size={15} /> Send Broadcast
          </Button>
        </div>
      </form>

      {/* Broadcast History */}
      <section className="space-y-4">
        <h3 className="font-display font-semibold text-ink text-lg flex items-center gap-2">
          <History size={18} className="text-accent" /> Past Broadcasts
        </h3>

        {loadingHistory ? (
          <div className="card p-8 text-center text-xs text-ink-muted">Loading broadcast history...</div>
        ) : broadcasts.length === 0 ? (
          <div className="card p-8 text-center text-xs text-ink-muted">No broadcasts sent yet.</div>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b) => (
              <div key={b.id} className="card p-4 space-y-1.5 border border-line">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink text-sm">{b.subject}</span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-semibold">
                    {b.sentCount} Recipients
                  </span>
                </div>
                <p className="text-xs text-ink-muted line-clamp-2">{b.body.replace(/<[^>]*>/g, '')}</p>
                <p className="text-[10px] text-ink-faint">
                  Sent on {new Date(b.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
