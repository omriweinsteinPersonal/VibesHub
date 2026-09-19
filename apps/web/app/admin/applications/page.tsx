'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiRequest } from '../../../lib/api';

interface Application {
  bioText: string | null;
  displayName: string | null;
  id: string;
  requestedHandle: string | null;
  status: string;
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    try {
      setApplications(await apiRequest<Application[]>('/admin/creator-applications'));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load the review queue.',
      );
    }
  }

  useEffect(() => {
    void apiRequest<Application[]>('/admin/creator-applications')
      .then(setApplications)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'Could not load the review queue.',
        ),
      );
  }, []);

  async function decide(application: Application, command: string) {
    setError('');
    try {
      await apiRequest(`/admin/creator-applications/${application.id}/${command}`, {
        body: JSON.stringify({ publicMessage: messages[application.id] || null }),
        idempotent: true,
        method: 'POST',
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The review action failed.');
    }
  }

  return (
    <main className="workspacePage">
      <header className="workspaceHeader">
        <Link className="logo" href="/">
          <span>
            <Sparkles aria-hidden="true" size={16} />
          </span>{' '}
          Swave
        </Link>
        <Link href="/account">Account</Link>
      </header>
      <section className="workspaceContent">
        <p className="eyebrow">MODERATION</p>
        <h1>Creator application queue</h1>
        {error ? <p className="formError">{error}</p> : null}
        <div className="reviewList">
          {applications.map((application) => (
            <article className="workspaceCard" key={application.id}>
              <p className="eyebrow">{application.status}</p>
              <h2>{application.displayName}</h2>
              <p>@{application.requestedHandle}</p>
              <p dir="rtl" lang="he">
                {application.bioText}
              </p>
              <textarea
                aria-label={`Applicant-visible message for ${application.displayName ?? 'applicant'}`}
                onChange={(event) =>
                  setMessages((current) => ({
                    ...current,
                    [application.id]: event.target.value,
                  }))
                }
                placeholder="Applicant-visible message for changes or rejection"
                rows={3}
                value={messages[application.id] ?? ''}
              />
              <div className="reviewActions">
                {application.status === 'submitted' ? (
                  <button
                    type="button"
                    onClick={() => decide(application, 'start-review')}
                  >
                    Start review
                  </button>
                ) : null}
                {application.status === 'under_review' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => decide(application, 'request-changes')}
                    >
                      Request changes
                    </button>
                    <button type="button" onClick={() => decide(application, 'reject')}>
                      Reject
                    </button>
                    <button
                      className="approve"
                      type="button"
                      onClick={() => decide(application, 'approve')}
                    >
                      Approve creator
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
          {!applications.length && !error ? (
            <p>No applications are waiting for review.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
