// Single source of truth = src/assets/ifn-mark.svg (the "IFN" gradient mark, same art
// as the favicon). vite-plugin-svgr turns it into a React component (the ?react query),
// so it is inlined into the bundle: rendered in one paint, no extra request, no load flash.
// Size it via className (e.g. "h-12 w-auto").
//
// NOTE: the old ICFAI wordmark (src/assets/icfai-founders.svg) is kept in the repo but is
// intentionally no longer used here pending the trademark/copyright review. To restore it,
// re-import that file and bring back the currentColor text classes below.
import LogoSvg from '../assets/ifn-mark.svg?react'

export default function Logo({ className = '' }) {
  // The IFN mark carries its own gradient + white lettering, so no theme color is applied;
  // className is only for sizing.
  return (
    <LogoSvg
      className={className}
      role="img"
      aria-label="IFN — ICFAI Founders Network"
    />
  )
}
