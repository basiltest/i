import './App.css'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'

function App() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) =>
      console.log('session:', data.session, 'error:', error)
    )
  }, [])

  return (
    <>
      <h1>IFN</h1>
    </>
  )
}

export default App
