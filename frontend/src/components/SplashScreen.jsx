import { useEffect, useState } from 'react';
import './SplashScreen.css';

function SplashScreen({ onComplete }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Start fading out after 2.2 seconds
    const fadeTimer = setTimeout(() => {
      setFade(true);
    }, 2200);

    // Call onComplete after transition finishes (2.2s + 0.5s transition = 2.7s)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`splash-container ${fade ? 'splash-fade' : ''}`}>
      <div className="splash-content">
        <div className="splash-logo-wrapper">
          <img src="/favicon.svg" alt="Find My Class Logo" className="splash-logo" />
          <div className="splash-ring"></div>
        </div>
        <h1 className="splash-title">Find My Class</h1>
        <p className="splash-subtitle">Smart Campus Locator</p>
      </div>
    </div>
  );
}

export default SplashScreen;
