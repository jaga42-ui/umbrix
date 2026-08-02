"use client";

import React from "react";

interface UiverseLoaderProps {
  label?: string;
  sublabel?: string;
  className?: string;
}

export function UiverseLoader({
  label,
  sublabel,
  className = "",
}: UiverseLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-6 gap-6 ${className}`}>
      {/* Container for the Uiverse Loader */}
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className="loader" />
      </div>

      {/* Typography Label */}
      {(label || sublabel) && (
        <div className="flex flex-col items-center text-center space-y-1">
          {label && (
            <span className="font-mono text-xs font-bold tracking-widest text-[#F8FAFC] uppercase">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="font-mono text-[10px] tracking-wider text-[#94A3B8] uppercase">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
