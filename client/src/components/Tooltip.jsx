import React from 'react';

export default function Tooltip({ text, children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56
                   -translate-x-1/2 rounded border border-gray-700 bg-gray-950
                   px-2 py-1.5 text-left text-xs leading-snug text-gray-100
                   opacity-0 shadow-xl transition group-hover:opacity-100
                   group-focus-within:opacity-100"
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
