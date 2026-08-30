import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [contactName, setContactName] = useState('')
  const [contactMessage, setContactMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  async function handleSignUp(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Account aangemaakt. Controleer je e-mail.')
    }

    setLoading(false)
  }

  async function handleSignIn() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    }

    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  async function handleAddContact(event: FormEvent) {
    event.preventDefault()

    if (!session || !contactName.trim()) return

    setContactMessage('')

    const { error } = await supabase.from('contacts').insert({
      user_id: session.user.id,
      name: contactName.trim(),
    })

    if (error) {
      setContactMessage(error.message)
      return
    }

    setContactName('')
    setContactMessage('Contact opgeslagen 🎉')
  }

  if (session) {
    return (
      <main>
        <h1>TikTact</h1>
        <p>Personal CRM</p>

        <h2>Welkom 👋</h2>
        <p>Je bent ingelogd als {session.user.email}</p>

        <h2>Contact toevoegen</h2>

        <form onSubmit={handleAddContact}>
          <input
            type="text"
            placeholder="Naam"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            required
          />

          <button type="submit">
            Opslaan
          </button>
        </form>

        {contactMessage && <p>{contactMessage}</p>}

        <button onClick={handleSignOut}>
          Uitloggen
        </button>
      </main>
    )
  }

  return (
    <main>
      <h1>TikTact</h1>
      <p>Personal CRM</p>

      <form onSubmit={handleSignUp}>
        <input
          type="email"
          placeholder="E-mailadres"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Wachtwoord"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />

        <button type="submit" disabled={loading}>
          Account aanmaken
        </button>

        <button type="button" onClick={handleSignIn} disabled={loading}>
          Inloggen
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}

export default App
