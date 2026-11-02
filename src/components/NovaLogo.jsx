import lightSurfaceLogo from '@/assets/nova logo.png';

// Approved Nova artwork, shared by account and document screens. Keep aspect
// ratio and clear space; do not replace the mark with a typeset letter N.
export default function NovaLogo({ size = 96, surface = 'dark', decorative = false, style, className }) {
  return <img src={surface === 'light' ? lightSurfaceLogo : '/logo.png'}
    alt={decorative ? '' : 'Nova Systems'} width={size} height={size} className={className}
    style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0,
      ...(surface === 'dark' ? { mixBlendMode: 'lighten' } : {}), ...style }} />;
}
