import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Start with false (desktop) as default to avoid hydration issues
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    // Immediately set the correct value on mount
    const checkIsMobile = () => window.innerWidth < MOBILE_BREAKPOINT
    setIsMobile(checkIsMobile())

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(checkIsMobile())
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
