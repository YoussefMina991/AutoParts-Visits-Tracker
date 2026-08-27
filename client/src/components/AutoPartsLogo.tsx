import React from 'react';

export function AutoPartsLogo({ className = "", style = {} }: { className?: string, style?: React.CSSProperties }) {
  return (
    <img
      src="/logo.png"
      alt="AutoParts Logo"
      className={className}
      style={{ width: '350%', height: '250%', objectFit: 'contain', ...style }}
    />
  );
}
