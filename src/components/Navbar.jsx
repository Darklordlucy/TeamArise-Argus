import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

export default function Navbar() {
  const location = useLocation();

  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const twScript = document.createElement('script');
      twScript.id = 'tailwind-script';
      twScript.src = 'https://cdn.tailwindcss.com?plugins=forms,container-queries';

      twScript.onload = () => {
        if (window.tailwind) {
          window.tailwind.config = {
            darkMode: "class",
            theme: {
              extend: {
                "colors": {
                  "on-primary": "#ffffff",
                  "surface-dim": "#dadad8",
                  "on-error": "#ffffff",
                  "error": "#ba1a1a",
                  "on-surface": "#1a1c1b",
                  "primary": "#ED1C24",
                  "primary-container": "#e71520",
                  "surface-tint": "#c00014",
                  "tertiary-fixed-dim": "#c7c6c6",
                  "surface-container-lowest": "#ffffff",
                  "secondary-fixed-dim": "#c8c6c5",
                  "inverse-surface": "#0A0A0A",
                  "on-secondary-fixed-variant": "#474646",
                  "tertiary": "#5b5c5c",
                  "error-container": "#ffdad6",
                  "on-secondary-fixed": "#1c1b1b",
                  "on-tertiary-container": "#fefcfc",
                  "on-primary-container": "#fffbff",
                  "surface-container": "#eeeeec",
                  "outline-variant": "#e8bcb7",
                  "on-tertiary": "#ffffff",
                  "on-background": "#1a1c1b",
                  "tertiary-fixed": "#e3e2e2",
                  "inverse-primary": "#ffb4ab",
                  "on-secondary": "#ffffff",
                  "outline": "#936e6a",
                  "on-tertiary-fixed-variant": "#464747",
                  "primary-fixed-dim": "#ffb4ab",
                  "on-tertiary-fixed": "#1b1c1c",
                  "surface": "#FAFAF8",
                  "surface-container-highest": "#e2e3e1",
                  "surface-bright": "#f9f9f7",
                  "secondary-container": "#e5e2e1",
                  "inverse-on-surface": "#FFFCF2",
                  "tertiary-container": "#747474",
                  "on-error-container": "#93000a",
                  "primary-fixed": "#ffdad6",
                  "secondary-fixed": "#e5e2e1",
                  "on-primary-fixed": "#410002",
                  "secondary": "#5f5e5e",
                  "surface-variant": "#e2e3e1",
                  "on-surface-variant": "#888888",
                  "background": "#FAFAF8",
                  "on-primary-fixed-variant": "#93000d",
                  "surface-container-high": "#e8e8e6",
                  "on-secondary-container": "#656464",
                  "surface-container-low": "#F0EEE9"
                },
                "borderRadius": {
                  "DEFAULT": "0px",
                  "lg": "4px",
                  "xl": "8px",
                  "full": "9999px"
                },
                "fontFamily": {
                  "headline": ["Space Grotesk"],
                  "body": ["Inter"],
                  "label": ["Inter"]
                }
              },
            },
          };
        }
      };
      document.head.appendChild(twScript);

      const font1 = document.createElement('link');
      font1.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=Inter:wght@300;400;600;700&display=swap';
      font1.rel = 'stylesheet';
      document.head.appendChild(font1);
    }
  }, []);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 w-full z-50 h-16 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-black/5 dark:border-white/5 flex justify-between items-center px-8 mx-auto">
      <div className="text-xl font-bold tracking-tighter text-black dark:text-white font-headline">
        ARGUS<span className="text-primary">·</span>AI
      </div>
      <div className="hidden md:flex gap-8 font-['Space_Grotesk'] tracking-tighter uppercase text-sm font-bold">
        <Link 
          className={`${isActive('/') ? 'text-primary border-b-2 border-primary pb-1' : 'text-neutral-500 hover:text-black dark:hover:text-white'} transition-all`} 
          to="/"
        >
          Product
        </Link>
        <Link 
          className={`${isActive('/map') ? 'text-primary border-b-2 border-primary pb-1' : 'text-neutral-500 hover:text-black dark:hover:text-white'} transition-all`} 
          to="/map"
        >
          Map &amp; Routing
        </Link>
        <Link 
          className={`${isActive('/dashboard') ? 'text-primary border-b-2 border-primary pb-1' : 'text-neutral-500 hover:text-black dark:hover:text-white'} transition-all`} 
          to="/dashboard"
        >
          Dashboard
        </Link>
      </div>
      <button className="bg-primary text-white px-5 py-2 font-headline uppercase tracking-tighter text-sm font-bold active:opacity-80 active:scale-95 transition-all">
        Get Early Access
      </button>
    </nav>
  );
}
