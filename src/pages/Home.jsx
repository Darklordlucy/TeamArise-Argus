import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a14 0%, #0d1a2a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        style={{ textAlign: 'center', maxWidth: '700px' }}
      >
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: '800',
          color: '#ffffff',
          lineHeight: 1.2,
          marginBottom: '1.5rem',
          textShadow: '0 0 30px rgba(0, 255, 200, 0.3)',
        }}>
          Intelligence in Oversight
        </h1>
        <p style={{
          fontSize: '1.15rem',
          color: '#8888aa',
          marginBottom: '2.5rem',
          lineHeight: 1.7,
        }}>
          Advanced real-time monitoring and data visualization platform.
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '0.85rem 2.2rem',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#0a0a14',
            background: '#00ffc8',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            boxShadow: '0 0 20px rgba(0, 255, 200, 0.4)',
          }}
        >
          Launch Dashboard
        </motion.button>
      </motion.div>
    </div>
  );
}
