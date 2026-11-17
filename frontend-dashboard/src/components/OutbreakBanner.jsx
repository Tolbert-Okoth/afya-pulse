import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const OutbreakBanner = ({ alerts, onDismiss }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="outbreak-container">
      {alerts.map((alert, index) => (
        <div key={index} className="outbreak-banner">
          <div className="outbreak-content">
            <div className="pulse-icon">
              <AlertTriangle size={26} color="white" />
            </div>
            <div>
              <strong>POSSIBLE CLUSTER · {alert.location.toUpperCase()}</strong>
              <p>{alert.message.replace(/^⚠️\s*SURVEILLANCE ALERT:\s*/, '')}</p>
            </div>
          </div>
          <button onClick={() => onDismiss(index)} className="dismiss-btn" aria-label="Dismiss alert">
            <X size={20} color="white" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default OutbreakBanner;