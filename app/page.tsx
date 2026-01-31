import { supabase } from "../lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const table = process.env.SUPABASE_TABLE;

  if (!table) {
    return (
      <main className="page">
        <div className="container">
          <div className="header">
            <span className="badge">Supabase Feed</span>
            <h1 className="title">Missing table configuration</h1>
            <p className="subtitle">
              Add <strong>SUPABASE_TABLE</strong> in your environment to fetch rows.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase.from(table).select("*");

  if (error) {
    return (
      <main className="page">
        <div className="container">
          <div className="header">
            <span className="badge">Supabase Feed</span>
            <h1 className="title">Unable to load rows</h1>
            <p className="subtitle">
              {error.message}. Check RLS policies for <strong>{table}</strong>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="header">
          <span className="badge">Supabase Feed</span>
          <h1 className="title">Latest rows from {table}</h1>
        </div>

        {data && data.length > 0 ? (
          <section className="grid">
            {data.map((row, index) => (
              <article className="card" key={row.id ?? index}>
                <div className="cardHeader">
                  <span>Row #{index + 1}</span>
                  <span className="pill">{table}</span>
                </div>
                <pre className="codeBlock">{JSON.stringify(row, null, 2)}</pre>
              </article>
            ))}
          </section>
        ) : (
          <div className="empty">No rows returned yet.</div>
        )}

      </div>
    </main>
  );
}
