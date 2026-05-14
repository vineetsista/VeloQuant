import { useEffect } from 'react'

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — VeloQuant` : 'VeloQuant'
    return () => { document.title = 'VeloQuant' }
  }, [title])
}
