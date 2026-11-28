// Links to the contact and policy pages served by the server (/contact, /terms, ...)
const LINKS = [
  ['/contact', 'Contact'],
  ['/terms', 'Terms'],
  ['/privacy', 'Privacy'],
  ['/refunds', 'Refunds'],
];

export default function PolicyLinks({ style }) {
  return (
    <nav
      aria-label="Policies"
      style={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        fontSize: 'var(--font-xs)',
        color: 'var(--text-muted)',
        ...style,
      }}
    >
      {LINKS.map(([href, label]) => (
        <a key={href} href={href} style={{ color: 'inherit' }}>{label}</a>
      ))}
    </nav>
  );
}
