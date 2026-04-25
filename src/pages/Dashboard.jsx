import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const { data: rows, error } = await supabase.from('incidents').select('*');
      if (error) {
        setError(error.message);
      } else {
        setData(rows);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Dashboard</h1>

      {loading && <p style={styles.status}>Loading data...</p>}
      {error && <p style={{ ...styles.status, color: '#ff4d6d' }}>Error: {error}</p>}

      {!loading && !error && data.length === 0 && (
        <p style={styles.status}>No records found.</p>
      )}

      <div style={styles.grid}>
        {data.map((item) => (
          <div key={item.id} style={styles.card}>
            {Object.entries(item).map(([key, value]) => (
              <div key={key} style={styles.row}>
                <span style={styles.key}>{key}</span>
                <span style={styles.value}>{String(value)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0a14',
    padding: '6rem 2.5rem 3rem',
  },
  heading: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#00ffc8',
    marginBottom: '2rem',
    letterSpacing: '0.1em',
  },
  status: {
    color: '#8888aa',
    fontSize: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(0,255,200,0.15)',
    borderRadius: '10px',
    padding: '1.2rem',
    backdropFilter: 'blur(8px)',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    fontSize: '0.85rem',
  },
  key: {
    color: '#00ffc8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  value: {
    color: '#c0c0d0',
    maxWidth: '55%',
    textAlign: 'right',
    wordBreak: 'break-word',
  },
};
