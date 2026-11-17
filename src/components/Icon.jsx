export function Icon({ name, size = 20, strokeWidth = 1.8, ...props }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    mother: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.6-3.5 3.1-5.5 6.5-5.5s5.9 2 6.5 5.5" /><path d="M12 14.5c1.4-2.1 3.4-2.8 4.8-1.9" /></>,
    baby: <><circle cx="12" cy="9" r="4.5" /><path d="M8 18c.9-2.2 2.3-3.2 4-3.2s3.1 1 4 3.2" /><path d="M9.5 8.3h.01M14.5 8.3h.01" /><path d="M10.2 11c.6.5 1.2.7 1.8.7s1.2-.2 1.8-.7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>,
    phone: <><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.4-3.4 2.6-5.4 6-5.4s5.6 2 6 5.4" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c2 .5 3.3 2.3 3.6 5.2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
    logout: <><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M16 8l4 4-4 4M20 12H9" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    check: <><path d="m5 12 4.5 4.5L19 7" /></>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17.2h.01" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 20h16" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></>,
    edit: <><path d="M4 20h4L20 8l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
    heart: <><path d="M20.5 8.5c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.5 4.5 0 0 1 12 6.2a4.5 4.5 0 0 1 8.5 2.3Z" /></>,
    wifiOff: <><path d="M3 3l18 18" /><path d="M8.5 8.5A10 10 0 0 1 21 9M3 9a15 15 0 0 1 3.5-1.2M6.5 13a9 9 0 0 1 3-1M10 16.5a5 5 0 0 1 4 0" /><circle cx="12" cy="20" r="1" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h4" /></>,
    filter: <><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" /></>,
    arrowRight: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    back: <><path d="M19 12H5M10 7l-5 5 5 5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
    file: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h4M9 13h6M9 17h6" /></>,
    printer: <><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
    shield: <><path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z" /></>,
    message: <><path d="M4 4h16v12H8l-4 4V4Z" /><path d="M8 9h8M8 12h5" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.5-4 3-6 7-6s6.5 2 7 6" /></>,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name] ?? paths.dashboard}
    </svg>
  )
}
