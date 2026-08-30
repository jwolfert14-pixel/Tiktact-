import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

type Page = 'home' | 'contacts' | 'dashboard'
type StatusFilter = 'all' | 'overdue' | 'today' | 'later' | 'none'

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
  const [page, setPage] = useState<Page>('home')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactMessage, setContactMessage] = useState('')

  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null)

  const [contactName, setContactName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [lastContactDate, setLastContactDate] = useState('')
  const [frequencyDays, setFrequencyDays] = useState('30')
  const [notes, setNotes] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [groupFilter, setGroupFilter] = useState('Alle')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortMode, setSortMode] = useState('urgency')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadContacts()
    else setContacts([])
  }, [session])

  async function loadContacts() {
    if (!session) return

    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, group_name, last_contact_date, desired_frequency_days, notes, created_at')
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

    const { error } = await supabase.auth.signUp({ email, password })

    setMessage(
      error
        ? error.message
        : 'Account aangemaakt. Controleer je e-mail.'
    )

    setLoading(false)
  }

  async function handleSignIn() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) setMessage(error.message)
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function resetContactForm() {
    setContactName('')
    setGroupName('')
    setLastContactDate('')
    setFrequencyDays('30')
    setNotes('')
    setEditingContactId(null)
  }

  function openNewContact() {
    resetContactForm()
    setContactMessage('')
    setShowContactForm(true)
    setPage('contacts')
  }

  function startEditing(contact: Contact) {
    setEditingContactId(contact.id)
    setContactName(contact.name)
    setGroupName(contact.group_name ?? '')
    setLastContactDate(contact.last_contact_date ?? '')
    setFrequencyDays(contact.desired_frequency_days?.toString() ?? '')
    setNotes(contact.notes ?? '')
    setShowContactForm(true)
    setPage('contacts')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSaveContact(event: FormEvent) {
    event.preventDefault()

    if (!session || !contactName.trim()) return

    const frequency =
      frequencyDays.trim() === ''
        ? null
        : Number(frequencyDays)

    if (
      frequency !== null &&
      (!Number.isFinite(frequency) || frequency < 1)
    ) {
      setContactMessage(
        'Vul een geldige frequentie van minimaal 1 dag in.'
      )
      return
    }

    const contactData = {
      name: contactName.trim(),
      group_name: groupName.trim() || null,
      last_contact_date: lastContactDate || null,
      desired_frequency_days: frequency,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const result = editingContactId
      ? await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', editingContactId)
      : await supabase
          .from('contacts')
          .insert({
            ...contactData,
            user_id: session.user.id,
          })

    if (result.error) {
      setContactMessage(result.error.message)
      return
    }

    setContactMessage(
      editingContactId
        ? 'Contact bijgewerkt ✓'
        : 'Contact opgeslagen ✓'
    )

    resetContactForm()
    setShowContactForm(false)
    await loadContacts()
  }

  async function handleDeleteContact(contact: Contact) {
    if (
      !window.confirm(
        `Weet je zeker dat je ${contact.name} wilt verwijderen?`
      )
    ) {
      return
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contact.id)

    if (error) {
      setContactMessage(error.message)
      return
    }

    if (editingContactId === contact.id) {
      resetContactForm()
      setShowContactForm(false)
    }

    setExpandedContactId(null)
    setContactMessage(`${contact.name} is verwijderd.`)
    await loadContacts()
  }

  function getTodayString() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  async function handleContactHad(contactId: string) {
    const { error } = await supabase
      .from('contacts')
      .update({
        last_contact_date: getTodayString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    if (error) {
      setContactMessage(error.message)
      return
    }

    setContactMessage('Contactmoment bijgewerkt ✓')
    await loadContacts()
  }

  function getNextContactDate(contact: Contact) {
    if (
      !contact.last_contact_date ||
      !contact.desired_frequency_days
    ) {
      return null
    }

    const date = new Date(
      `${contact.last_contact_date}T12:00:00`
    )

    date.setDate(
      date.getDate() + contact.desired_frequency_days
    )

    return date
  }

  function getDifferenceDays(contact: Contact) {
    const nextDate = getNextContactDate(contact)
    if (!nextDate) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const next = new Date(nextDate)
    next.setHours(0, 0, 0, 0)

    return Math.round(
      (next.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  }

  function getContactStatus(contact: Contact) {
    const days = getDifferenceDays(contact)

    if (days === null) {
      return {
        label: 'Geen planning',
        type: 'none',
      }
    }

    if (days < 0) {
      const late = Math.abs(days)

      return {
        label: `${late} ${late === 1 ? 'dag' : 'dagen'} te laat`,
        type: 'overdue',
      }
    }

    if (days === 0) {
      return {
        label: 'Vandaag',
        type: 'today',
      }
    }

    if (days === 1) {
      return {
        label: 'Morgen',
        type: 'upcoming',
      }
    }

    return {
      label: `Over ${days} dagen`,
      type: 'upcoming',
    }
  }

  function formatDate(date: Date | string | null) {
    if (!date) return 'Niet ingesteld'

    const value =
      typeof date === 'string'
        ? new Date(`${date}T12:00:00`)
        : date

    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(value)
  }

  function urgencyValue(contact: Contact) {
    return (
      getNextContactDate(contact)?.getTime() ??
      Number.MAX_SAFE_INTEGER
    )
  }

  function matchesStatus(contact: Contact) {
    const days = getDifferenceDays(contact)

    if (statusFilter === 'all') return true
    if (statusFilter === 'overdue') {
      return days !== null && days < 0
    }
    if (statusFilter === 'today') return days === 0
    if (statusFilter === 'later') {
      return days !== null && days > 0
    }

    return days === null
  }

  const groups = Array.from(
    new Set(
      contacts
        .map((contact) => contact.group_name)
        .filter((group): group is string => Boolean(group))
    )
  ).sort((a, b) => a.localeCompare(b, 'nl'))

  const filteredContacts = contacts
    .filter((contact) => {
      const term = searchTerm.toLowerCase().trim()

      const matchesSearch =
        !term ||
        contact.name.toLowerCase().includes(term) ||
        (contact.notes ?? '').toLowerCase().includes(term)

      const matchesGroup =
        groupFilter === 'Alle' ||
        contact.group_name === groupFilter

      return (
        matchesSearch &&
        matchesGroup &&
        matchesStatus(contact)
      )
    })
    .sort((a, b) =>
      sortMode === 'name'
        ? a.name.localeCompare(b.name, 'nl')
        : urgencyValue(a) - urgencyValue(b)
    )

  const dueContacts = contacts
    .filter((contact) => {
      const days = getDifferenceDays(contact)
      return days !== null && days <= 0
    })
    .sort(
      (a, b) =>
        urgencyValue(a) - urgencyValue(b)
    )

  const overdueCount = contacts.filter((contact) => {
    const days = getDifferenceDays(contact)
    return days !== null && days < 0
  }).length

  const todayCount = contacts.filter(
    (contact) => getDifferenceDays(contact) === 0
  ).length

  const laterCount = contacts.filter((contact) => {
    const days = getDifferenceDays(contact)
    return days !== null && days > 0
  }).length

  const unplannedCount = contacts.filter(
    (contact) => getDifferenceDays(contact) === null
  ).length

  const groupStats = groups
    .map((group) => ({
      group,
      count: contacts.filter(
        (contact) => contact.group_name === group
      ).length,
    }))
    .sort((a, b) => b.count - a.count)

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand">
            <h1>TikTact</h1>
            <p>
              Blijf in contact met de mensen die ertoe doen.
            </p>
          </div>

          <form
            className="form-stack"
            onSubmit={handleSignUp}
          >
            <label>
              E-mailadres
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />
            </label>

            <label>
              Wachtwoord
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                minLength={6}
                required
              />
            </label>

            <button
              className="primary-button"
              type="button"
              onClick={handleSignIn}
              disabled={loading}
            >
              Inloggen
            </button>

            <button
              className="secondary-button"
              type="submit"
              disabled={loading}
            >
              Account aanmaken
            </button>
          </form>

          {message && (
            <p className="feedback">{message}</p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>TikTact</h1>
          <p className="subtitle">
            Blijf in contact met de mensen die ertoe doen.
          </p>
        </div>

        <button
          className="text-button"
          onClick={handleSignOut}
        >
          Uitloggen
        </button>
      </header>

      <nav
        className="top-nav"
        aria-label="Hoofdnavigatie"
      >
        <button
          className={
            page === 'home'
              ? 'top-nav-item active'
              : 'top-nav-item'
          }
          onClick={() => setPage('home')}
        >
          Home
        </button>

        <button
          className={
            page === 'contacts'
              ? 'top-nav-item active'
              : 'top-nav-item'
          }
          onClick={() => setPage('contacts')}
        >
          Contacten
        </button>

        <button
          className={
            page === 'dashboard'
              ? 'top-nav-item active'
              : 'top-nav-item'
          }
          onClick={() => setPage('dashboard')}
        >
          Dashboard
        </button>
      </nav>

      {page === 'home' && (
        <>
          <section className="hero-panel">
            <span className="eyebrow">Home</span>
            <h2>Prioriteit vandaag</h2>
            <p>
              {dueContacts.length === 0
                ? 'Je bent helemaal bij.'
                : `${dueContacts.length} contact(en) vragen aandacht.`}
            </p>
          </section>

          <section className="panel">
            {dueContacts.length === 0 ? (
              <div className="empty-state">
                <strong>
                  Je bent helemaal bij ✓
                </strong>
                <p>
                  Niemand staat vandaag op de planning.
                </p>
              </div>
            ) : (
              <div className="priority-list">
                {dueContacts.map((contact) => {
                  const status =
                    getContactStatus(contact)

                  return (
                    <article
                      className="priority-card"
                      key={contact.id}
                    >
                      <div className="priority-main">
                        <span>
                          <strong>
                            {contact.name}
                          </strong>
                          <small>
                            {contact.group_name ||
                              'Geen groep'}
                          </small>
                        </span>

                        <span
                          className={`status status-${status.type}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      {contact.notes && (
                        <p className="topic-line">
                          {contact.notes}
                        </p>
                      )}

                      <button
                        className="primary-button compact-button"
                        onClick={() =>
                          handleContactHad(
                            contact.id
                          )
                        }
                      >
                        Contact gehad
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {page === 'contacts' && (
        <>
          <section className="page-title-row">
            <div>
              <span className="eyebrow">
                Contacten
              </span>
              <h2>Mijn contacten</h2>
            </div>

            <button
              className="add-button"
              onClick={openNewContact}
              aria-label="Contact toevoegen"
              title="Contact toevoegen"
            >
              +
            </button>
          </section>

          {showContactForm && (
            <section className="panel form-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {editingContactId
                      ? 'Aanpassen'
                      : 'Nieuw'}
                  </span>
                  <h2>
                    {editingContactId
                      ? 'Contact bewerken'
                      : 'Contact toevoegen'}
                  </h2>
                </div>

                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setShowContactForm(false)
                    resetContactForm()
                  }}
                >
                  Sluiten
                </button>
              </div>

              <form
                className="contact-form"
                onSubmit={handleSaveContact}
              >
                <label>
                  Naam
                  <input
                    value={contactName}
                    onChange={(event) =>
                      setContactName(
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Groep
                  <input
                    list="group-options"
                    placeholder="Familie, Vrienden, Sportclub..."
                    value={groupName}
                    onChange={(event) =>
                      setGroupName(
                        event.target.value
                      )
                    }
                  />
                </label>

                <datalist id="group-options">
                  <option value="Familie" />
                  <option value="Vrienden" />
                  <option value="Netwerk" />
                  {groups.map((group) => (
                    <option
                      key={group}
                      value={group}
                    />
                  ))}
                </datalist>

                <label>
                  Laatste contact
                  <input
                    type="date"
                    value={lastContactDate}
                    onChange={(event) =>
                      setLastContactDate(
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Frequentie in dagen
                  <input
                    type="number"
                    min="1"
                    value={frequencyDays}
                    onChange={(event) =>
                      setFrequencyDays(
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="full-width">
                  Notitie
                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                  />
                </label>

                <div className="form-actions full-width">
                  <button
                    className="primary-button"
                    type="submit"
                  >
                    {editingContactId
                      ? 'Wijzigingen opslaan'
                      : 'Contact opslaan'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {contactMessage && (
            <p className="feedback">
              {contactMessage}
            </p>
          )}

          <section className="panel">
            <div className="status-tabs">
              {([
                ['all', `Alles ${contacts.length}`],
                [
                  'overdue',
                  `Te laat ${overdueCount}`,
                ],
                [
                  'today',
                  `Vandaag ${todayCount}`,
                ],
                ['later', `Later ${laterCount}`],
                [
                  'none',
                  `Geen planning ${unplannedCount}`,
                ],
              ] as [StatusFilter, string][]).map(
                ([value, label]) => (
                  <button
                    key={value}
                    className={
                      statusFilter === value
                        ? 'filter-chip active'
                        : 'filter-chip'
                    }
                    onClick={() =>
                      setStatusFilter(value)
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div className="filters">
              <input
                type="search"
                placeholder="Zoek contacten..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
              />

              <select
                value={groupFilter}
                onChange={(event) =>
                  setGroupFilter(
                    event.target.value
                  )
                }
              >
                <option value="Alle">
                  Alle groepen
                </option>

                {groups.map((group) => (
                  <option
                    key={group}
                    value={group}
                  >
                    {group}
                  </option>
                ))}
              </select>

              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value)
                }
              >
                <option value="urgency">
                  Meest urgent
                </option>
                <option value="name">
                  Naam A-Z
                </option>
              </select>
            </div>

            {filteredContacts.length === 0 ? (
              <div className="empty-state">
                <strong>
                  Geen contacten gevonden
                </strong>
              </div>
            ) : (
              <div className="contact-grid">
                {filteredContacts.map(
                  (contact) => {
                    const status =
                      getContactStatus(contact)

                    const expanded =
                      expandedContactId ===
                      contact.id

                    return (
                      <article
                        className="contact-card"
                        key={contact.id}
                      >
                        <button
                          className="contact-summary"
                          onClick={() =>
                            setExpandedContactId(
                              expanded
                                ? null
                                : contact.id
                            )
                          }
                        >
                          <span>
                            <h3>
                              {contact.name}
                            </h3>

                            {contact.group_name && (
                              <span className="group-badge">
                                {
                                  contact.group_name
                                }
                              </span>
                            )}
                          </span>

                          <span
                            className={`status status-${status.type}`}
                          >
                            {status.label}
                          </span>
                        </button>

                        {expanded && (
                          <div className="contact-expanded">
                            <dl className="contact-details">
                              <div>
                                <dt>
                                  Laatste contact
                                </dt>
                                <dd>
                                  {formatDate(
                                    contact.last_contact_date
                                  )}
                                </dd>
                              </div>

                              <div>
                                <dt>
                                  Volgend contact
                                </dt>
                                <dd>
                                  {formatDate(
                                    getNextContactDate(
                                      contact
                                    )
                                  )}
                                </dd>
                              </div>

                              <div>
                                <dt>
                                  Frequentie
                                </dt>
                                <dd>
                                  {contact.desired_frequency_days
                                    ? `${contact.desired_frequency_days} dagen`
                                    : 'Niet ingesteld'}
                                </dd>
                              </div>
                            </dl>

                            {contact.notes && (
                              <p className="contact-note">
                                {contact.notes}
                              </p>
                            )}

                            <div className="contact-actions">
                              <button
                                className="primary-button compact-button"
                                onClick={() =>
                                  handleContactHad(
                                    contact.id
                                  )
                                }
                              >
                                Contact gehad
                              </button>

                              <button
                                className="secondary-button compact-button"
                                onClick={() =>
                                  startEditing(
                                    contact
                                  )
                                }
                              >
                                Bewerken
                              </button>

                              <button
                                className="danger-button compact-button"
                                onClick={() =>
                                  handleDeleteContact(
                                    contact
                                  )
                                }
                              >
                                Verwijderen
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  }
                )}
              </div>
            )}
          </section>
        </>
      )}

      {page === 'dashboard' && (
        <>
          <section className="page-title-row">
            <div>
              <span className="eyebrow">
                Dashboard
              </span>
              <h2>Relatie-overzicht</h2>
            </div>
          </section>

          <section className="stats-grid dashboard-stats">
            <div className="stat-card">
              <span>Totaal</span>
              <strong>{contacts.length}</strong>
            </div>

            <div className="stat-card">
              <span>Vandaag</span>
              <strong>{todayCount}</strong>
            </div>

            <div className="stat-card danger-stat">
              <span>Te laat</span>
              <strong>{overdueCount}</strong>
            </div>

            <div className="stat-card">
              <span>Later</span>
              <strong>{laterCount}</strong>
            </div>
          </section>

          <section className="panel">
            <span className="eyebrow">
              Groepen
            </span>
            <h2>Verdeling</h2>

            <div className="metric-list">
              {groupStats.length === 0 ? (
                <p>Nog geen groepen.</p>
              ) : (
                groupStats.map((item) => (
                  <div
                    className="metric-row"
                    key={item.group}
                  >
                    <span>{item.group}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default App
