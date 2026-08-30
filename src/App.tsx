import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

type Contact = {
  id: string
  name: string
  group_name: string | null
  last_contact_date: string | null
  desired_frequency_days: number | null
  notes: string | null
  created_at: string
}

function App() {
  const [session, setSession] = useState<Session | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactMessage, setContactMessage] = useState('')

  const [contactName, setContactName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [lastContactDate, setLastContactDate] = useState('')
  const [frequencyDays, setFrequencyDays] = useState('30')
  const [notes, setNotes] = useState('')

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

  useEffect(() => {
    if (session) {
      loadContacts()
    } else {
      setContacts([])
    }
  }, [session])

  async function loadContacts() {
    if (!session) return

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        group_name,
        last_contact_date,
        desired_frequency_days,
        notes,
        created_at
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setContactMessage(error.message)
      return
    }

    setContacts(data ?? [])
  }

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

    const frequency =
      frequencyDays.trim() === ''
        ? null
        : Number(frequencyDays)

    const { error } = await supabase.from('contacts').insert({
      user_id: session.user.id,
      name: contactName.trim(),
      group_name: groupName.trim() || null,
      last_contact_date: lastContactDate || null,
      desired_frequency_days: frequency,
      notes: notes.trim() || null,
    })

    if (error) {
      setContactMessage(error.message)
      return
    }

    setContactName('')
    setGroupName('')
    setLastContactDate('')
    setFrequencyDays('30')
    setNotes('')

    setContactMessage('Contact opgeslagen 🎉')

    await loadContacts()
  }

  async function handleContactHad(contactId: string) {
    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('contacts')
      .update({
        last_contact_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    if (error) {
      setContactMessage(error.message)
      return
    }

    setContactMessage('Contactmoment bijgewerkt 🎉')
    await loadContacts()
  }

  function getNextContactDate(contact: Contact) {
    if (
      !contact.last_contact_date ||
      !contact.desired_frequency_days
    ) {
      return null
    }

    const date = new Date(`${contact.last_contact_date}T12:00:00`)
    date.setDate(
      date.getDate() + contact.desired_frequency_days
    )

    return date
  }

  function formatDate(date: Date | string | null) {
    if (!date) return 'Nog niet ingesteld'

    const value =
      typeof date === 'string'
        ? new Date(`${date}T12:00:00`)
        : date

    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(value)
  }

  function getContactStatus(contact: Contact) {
    const nextDate = getNextContactDate(contact)

    if (!nextDate) {
      return 'Geen planning'
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const next = new Date(nextDate)
    next.setHours(0, 0, 0, 0)

    const differenceMs = next.getTime() - today.getTime()
    const differenceDays = Math.ceil(
      differenceMs / (1000 * 60 * 60 * 24)
    )

    if (differenceDays < 0) {
      return `${Math.abs(differenceDays)} dagen te laat`
    }

    if (differenceDays === 0) {
      return 'Vandaag contact opnemen'
    }

    if (differenceDays === 1) {
      return 'Morgen contact opnemen'
    }

    return `Over ${differenceDays} dagen`
  }

  function sortContacts(contactList: Contact[]) {
    return [...contactList].sort((a, b) => {
      const dateA = getNextContactDate(a)
      const dateB = getNextContactDate(b)

      if (!dateA && !dateB) return a.name.localeCompare(b.name)
      if (!dateA) return 1
      if (!dateB) return -1

      return dateA.getTime() - dateB.getTime()
    })
  }

  const sortedContacts = sortContacts(contacts)

  const dueContacts = sortedContacts.filter((contact) => {
    const nextDate = getNextContactDate(contact)

    if (!nextDate) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    nextDate.setHours(0, 0, 0, 0)

    return nextDate <= today
  })

  if (session) {
    return (
      <main>
        <h1>TikTact</h1>
        <p>Personal CRM</p>

        <h2>Vandaag</h2>

        {dueContacts.length === 0 ? (
          <p>Niemand hoeft vandaag contact 🎉</p>
        ) : (
          <ul>
            {dueContacts.map((contact) => (
              <li key={contact.id}>
                <strong>{contact.name}</strong>
                {' — '}
                {getContactStatus(contact)}

                <button
                  type="button"
                  onClick={() => handleContactHad(contact.id)}
                >
                  Ik heb contact gehad
                </button>
              </li>
            ))}
          </ul>
        )}

        <h2>Contact toevoegen</h2>

        <form onSubmit={handleAddContact}>
          <div>
            <label>
              Naam
              <input
                type="text"
                placeholder="Bijvoorbeeld Jan"
                value={contactName}
                onChange={(event) =>
                  setContactName(event.target.value)
                }
                required
              />
            </label>
          </div>

          <div>
            <label>
              Groep
              <select
                value={groupName}
                onChange={(event) =>
                  setGroupName(event.target.value)
                }
              >
                <option value="">Geen groep</option>
                <option value="Familie">Familie</option>
                <option value="Vrienden">Vrienden</option>
                <option value="Netwerk">Netwerk</option>
              </select>
            </label>
          </div>

          <div>
            <label>
              Laatste contactdatum
              <input
                type="date"
                value={lastContactDate}
                onChange={(event) =>
                  setLastContactDate(event.target.value)
                }
              />
            </label>
          </div>

          <div>
            <label>
              Contact iedere
              <input
                type="number"
                min="1"
                value={frequencyDays}
                onChange={(event) =>
                  setFrequencyDays(event.target.value)
                }
              />
              dagen
            </label>
          </div>

          <div>
            <label>
              Notities
              <textarea
                placeholder="Optionele notitie"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
              />
            </label>
          </div>

          <button type="submit">
            Contact opslaan
          </button>
        </form>

        {contactMessage && <p>{contactMessage}</p>}

        <h2>Mijn contacten</h2>

        {sortedContacts.length === 0 ? (
          <p>Nog geen contacten.</p>
        ) : (
          <ul>
            {sortedContacts.map((contact) => {
              const nextContactDate =
                getNextContactDate(contact)

              return (
                <li key={contact.id}>
                  <h3>{contact.name}</h3>

                  {contact.group_name && (
                    <p>Groep: {contact.group_name}</p>
                  )}

                  <p>
                    Laatste contact:{' '}
                    {formatDate(contact.last_contact_date)}
                  </p>

                  <p>
                    Frequentie:{' '}
                    {contact.desired_frequency_days
                      ? `iedere ${contact.desired_frequency_days} dagen`
                      : 'Niet ingesteld'}
                  </p>

                  <p>
                    Volgend contact:{' '}
                    {formatDate(nextContactDate)}
                  </p>

                  <strong>
                    {getContactStatus(contact)}
                  </strong>

                  {contact.notes && (
                    <p>Notitie: {contact.notes}</p>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        handleContactHad(contact.id)
                      }
                    >
                      Ik heb contact gehad
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <hr />

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
          onChange={(event) =>
            setPassword(event.target.value)
          }
          minLength={6}
          required
        />

        <button
          type="submit"
          disabled={loading}
        >
          Account aanmaken
        </button>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
        >
          Inloggen
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}

export default App
