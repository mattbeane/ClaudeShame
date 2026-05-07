import { getLeaderboard } from '@/lib/store';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Window = 'all-time' | 'week' | 'by-model';

export default async function Page({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const params = await searchParams;
  const win: Window = (['all-time', 'week', 'by-model'] as const).includes(
    params.window as Window
  )
    ? (params.window as Window)
    : 'all-time';
  const entries = getLeaderboard(win);

  return (
    <main>
      <header>
        <h1>Zeitgeist Police</h1>
        <p className="tagline">When Claude tics, Claude pays.</p>
        <nav>
          <Link href="/">chalkboard</Link>
          <Link href="/leaderboard" className="active">leaderboard</Link>
        </nav>
      </header>

      <div className="tabs">
        <Link href="/leaderboard?window=all-time" className={win === 'all-time' ? 'active' : ''}>
          all-time
        </Link>
        <Link href="/leaderboard?window=week" className={win === 'week' ? 'active' : ''}>
          this week
        </Link>
        <Link href="/leaderboard?window=by-model" className={win === 'by-model' ? 'active' : ''}>
          by model
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="empty">No data yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>phrase</th>
              {win === 'by-model' && <th>model</th>}
              <th style={{ textAlign: 'right' }}>infractions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row, i) => (
              <tr key={`${row.phrase}-${row.model || ''}`}>
                <td className="rank">{i + 1}</td>
                <td className="phrase">"{row.phrase}"</td>
                {win === 'by-model' && <td className="model">{row.model}</td>}
                <td className="count">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
