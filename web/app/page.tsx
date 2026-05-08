import { getFeed, type Shaming } from '@/lib/store';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VISIBLE_LINES = 15;

function formatStamp(ts: number): string {
  const d = new Date(ts);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  let hour = d.getUTCHours();
  const min = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${month} ${day} · ${hour}:${min} ${ampm} UTC`;
}

function lineFor(s: Shaming): string {
  const subject = s.attribution || 'humans';
  return `I will not use "${s.phrase}" with ${subject} again.`;
}

function BartBoard({ shaming }: { shaming: Shaming }) {
  const line = lineFor(shaming);
  return (
    <div className="bart-frame">
      <div className="bart-board">
        <div className="bart-datestamp" aria-label="time of offense">
          {formatStamp(shaming.timestamp)}
        </div>
        {Array.from({ length: VISIBLE_LINES }).map((_, i) => (
          <div key={i} className="bart-line">{line}</div>
        ))}
      </div>
      <div className="bart-ledge">
        <span className="chalk-pieces" aria-hidden="true">
          <span /><span /><span />
        </span>
        <span className="eraser" aria-hidden="true" />
        <span className="meta">
          <strong>×{shaming.count}</strong>
          <span>·</span>
          <span>{shaming.model}</span>
          <span>·</span>
          <span>{shaming.attribution || 'anonymous'}</span>
        </span>
      </div>
    </div>
  );
}

function EmptyBoard() {
  return (
    <div className="bart-frame">
      <div className="bart-board">
        <div className="bart-empty">
          <div className="big">The chalkboard is clean.</div>
          <div className="small">(For now.)</div>
        </div>
      </div>
      <div className="bart-ledge">
        <span className="chalk-pieces" aria-hidden="true">
          <span /><span /><span />
        </span>
        <span className="eraser" aria-hidden="true" />
        <span className="meta">awaiting first offense</span>
      </div>
    </div>
  );
}

function LogEntry({ shaming }: { shaming: Shaming }) {
  return (
    <div className="log-entry">
      <span className="phrase">"{shaming.phrase}"</span>
      <span className="count">×{shaming.count}</span>
      <span className="model">{shaming.model}</span>
      <span className="stamp">{formatStamp(shaming.timestamp)}</span>
      <span className="meta">{shaming.attribution || 'anonymous'}</span>
    </div>
  );
}

export default async function Page() {
  const shamings = await getFeed(50);
  const [latest, ...rest] = shamings;

  return (
    <main>
      <header className="site-head">
        <h1>Claude Shame</h1>
        <p className="tagline">When Claude tics, Claude pays.</p>
        <nav className="site-nav">
          <Link href="/" className="active">chalkboard</Link>
          <Link href="/leaderboard">leaderboard</Link>
          <Link href="/submissions">submissions</Link>
        </nav>
      </header>

      {latest ? <BartBoard shaming={latest} /> : <EmptyBoard />}

      {rest.length > 0 && (
        <section className="log-section">
          <h2>Earlier offenses</h2>
          <div className="logbook">
            {rest.map((s) => <LogEntry key={s.id} shaming={s} />)}
          </div>
        </section>
      )}

      <footer className="site-foot">
        <p>
          Phrases are curated. Submit one via{' '}
          <code>zp submit "your phrase"</code> or open a PR.
        </p>
      </footer>
    </main>
  );
}
