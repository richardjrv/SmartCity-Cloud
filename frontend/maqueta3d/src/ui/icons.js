const paths = {
  city: '<path d="M3 21V9h6V3h8v10h4v8H3Z"/><path d="M9 21V9m4-2v2m0 4v2M6 13v2m0 3v1"/>',
  cube: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5m-9 5v9M7.5 5.5l9 5"/>',
  traffic: '<rect x="7" y="2" width="10" height="17" rx="3"/><path d="M12 19v3"/><circle cx="12" cy="6" r="1"/><circle cx="12" cy="10.5" r="1"/><circle cx="12" cy="15" r="1"/>',
  lamp: '<path d="M12 22V8a5 5 0 0 1 10 0h-10m-2 14h4M3 9h4m-2-6 3 3m-2 9 3-3"/>',
  parking: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  water: '<path d="M12 2s-5 6-5 9a5 5 0 0 0 10 0c0-3-5-9-5-9ZM2 21c2-2 4 2 6 0s4 2 6 0 4 2 8 0"/>',
  climate: '<path d="M8 14.5V5a3 3 0 0 0-6 0v9.5a5 5 0 1 0 6 0ZM5 10v8m10-2a4 4 0 1 0 0-8m0-6v2m7 3-2 1m2 7-2-1m-5 6v2"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 4h.01"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.cube}</svg>`;
}
