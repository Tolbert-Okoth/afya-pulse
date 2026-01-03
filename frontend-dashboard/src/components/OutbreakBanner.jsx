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
              <AlertTriangle size={28} color="white" fill="#EF4444" />
            </div>
            <div>
              <strong>⚠️ EPIDEMIC ALERT: {alert.location.toUpperCase()}</strong>
              <p>{alert.message}</p>
            </div>
          </div>
          <button onClick={() => onDismiss(index)} className="dismiss-btn">
            <X size={20} color="white" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default OutbreakBanner;