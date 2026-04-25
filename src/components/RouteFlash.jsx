import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function RouteFlash() {
  const location = useLocation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(true)
    const t = setTimeout(() => setShow(false), 500)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={location.pathname}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, #ED1C24, #ff6b6b, #ED1C24)',
            transformOrigin: 'left',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        />
      )}
    </AnimatePresence>
  )
}
