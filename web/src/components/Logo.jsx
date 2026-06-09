// Single source of truth = src/assets/icfai-founders.svg. vite-plugin-svgr turns it into a
// React component (the ?react query), so it is inlined into the bundle: rendered in one paint,
// no extra request, no load flash. Size it via className (e.g. "h-12 w-auto").
import LogoSvg from '../assets/icfai-founders.svg?react'

export default function Logo({ className = '' }) {
  // The ICFAI letters use currentColor: navy in light, light indigo in dark (the red bar
  // and white "FOUNDERS NETWORK" keep their own fills).
  return (
    <LogoSvg
      className={`text-[#2c2a82] dark:text-[#a5b4fc] ${className}`}
      role="img"
      aria-label="ICFAI Founders Network"
    />
  )
}
