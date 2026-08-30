import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

type Page = 'home' | 'contacts' | 'dashboard'
type StatusFilter = 'all' | 'overdue' | 'today' | 'later' | 'none'
type StatusType = 'overdue' | 'today' | 'upcoming' | 'none'

type Contact = {
  id: string
  name: string
  group_name: string | null
  last_contact_date: string | null
  desired_frequency_days: number | null
  notes: string | null
  birthday: string | null
  important_date: string | null
  important_date_label: string | null
  last_topic: string | null
  snooze_until: string | null
  created_at: string
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [page, setPage] = useState<Page>('home')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactMessage, setContactMessage] = useState('')

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)

  const [contactName, setContactName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [lastContactDate, setLastContactDate] = useState('')
  const [frequencyDays, setFrequencyDays] = useState('30')
  const [notes, setNotes] = useState('')
  const [birthday, setBirthday] = useState('')
  const [importantDate, setImportantDate] = useState('')
  const [importantDateLabel, setImportantDateLabel] = useState('')
  const [lastTopic, setLastTopic] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [groupFilter, setGroupFilter] = useState('Alle')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortMode, setSortMode] = useState<'urgency' | 'name'>('urgency')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) void loadContacts()
    else setContacts([])
  }, [session])

  useEffect(() => {
    if (!formOpen && !selectedContactId) return

    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (formOpen) closeForm()
      else setSelectedContactId(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [formOpen, selectedContactId])

  async function loadContacts() {
    if (!session) return
    const { data, error } = await supabase
      .from('contacts')
      .select('id,name,group_name,last_contact_date,desired_frequency_days,notes,birthday,important_date,important_date_label,last_topic,snooze_until,created_at')
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
    setAuthMessage('')
    const { error } = await supabase.auth.signUp({ email, password })
    setAuthMessage(error ? error.message : 'Account aangemaakt. Controleer je e-mail.')
    setLoading(false)
  }

  async function handleSignIn() {
    setLoading(true)
    setAuthMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthMessage(error.message)
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function todayString(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  function parseDate(value: string) {
    return new Date(`${value}T12:00:00`)
  }

  function resetForm() {
    setContactName('')
    setGroupName('')
    setLastContactDate('')
    setFrequencyDays('30')
    setNotes('')
    setBirthday('')
    setImportantDate('')
    setImportantDateLabel('')
    setLastTopic('')
    setEditingContactId(null)
  }

  function openNewContact() {
    resetForm()
    setSelectedContactId(null)
    setContactMessage('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    resetForm()
  }

  function startEditing(contact: Contact) {
    setSelectedContactId(null)
    setEditingContactId(contact.id)
    setContactName(contact.name)
    setGroupName(contact.group_name ?? '')
    setLastContactDate(contact.last_contact_date ?? '')
    setFrequencyDays(contact.desired_frequency_days?.toString() ?? '')
    setNotes(contact.notes ?? '')
    setBirthday(contact.birthday ?? '')
    setImportantDate(contact.important_date ?? '')
    setImportantDateLabel(contact.important_date_label ?? '')
    setLastTopic(contact.last_topic ?? '')
    setFormOpen(true)
  }

  async function saveContact(event: FormEvent) {
    event.preventDefault()
    if (!session || !contactName.trim()) return

    const frequency = frequencyDays.trim() === '' ? null : Number(frequencyDays)
    if (frequency !== null && (!Number.isFinite(frequency) || frequency < 1)) {
      setContactMessage('Vul een geldige frequentie van minimaal 1 dag in.')
      return
    }

    const payload = {
      name: contactName.trim(),
      group_name: groupName.trim() || null,
      last_contact_date: lastContactDate || null,
      desired_frequency_days: frequency,
      notes: notes.trim() || null,
      birthday: birthday || null,
      important_date: importantDate || null,
      important_date_label: importantDateLabel.trim() || null,
      last_topic: lastTopic.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const editedId = editingContactId
    const result = editingContactId
      ? await supabase.from('contacts').update(payload).eq('id', editingContactId).eq('user_id', session.user.id)
      : await supabase.from('contacts').insert({ ...payload, user_id: session.user.id })

    if (result.error) {
      setContactMessage(result.error.message)
      return
    }

    setContactMessage(editingContactId ? 'Contact bijgewerkt ✓' : 'Contact opgeslagen ✓')
    closeForm()
    await loadContacts()
    if (editedId) setSelectedContactId(editedId)
  }

  async function markContactHad(contactId: string) {
    if (!session) return
    const { error } = await supabase
      .from('contacts')
      .update({ last_contact_date: todayString(), snooze_until: null, updated_at: new Date().toISOString() })
      .eq('id', contactId)
      .eq('user_id', session.user.id)

    if (error) setContactMessage(error.message)
    else {
      setContactMessage('Contactmoment bijgewerkt ✓')
      await loadContacts()
    }
  }

  async function snoozeContact(contactId: string, days = 7) {
    if (!session) return
    const date = new Date()
    date.setDate(date.getDate() + days)

    const { error } = await supabase
      .from('contacts')
      .update({ snooze_until: todayString(date), updated_at: new Date().toISOString() })
      .eq('id', contactId)
      .eq('user_id', session.user.id)

    if (error) setContactMessage(error.message)
    else {
      setContactMessage(`Contact ${days} dagen uitgesteld.`)
      await loadContacts()
    }
  }

  async function deleteContact(contact: Contact) {
    if (!session) return
    if (!window.confirm(`Weet je zeker dat je ${contact.name} wilt verwijderen?`)) return

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contact.id)
      .eq('user_id', session.user.id)

    if (error) setContactMessage(error.message)
    else {
      setSelectedContactId(null)
      setContactMessage(`${contact.name} is verwijderd.`)
      await loadContacts()
    }
  }

  function nextContactDate(contact: Contact) {
    if (!contact.last_contact_date || !contact.desired_frequency_days) return null
    const date = parseDate(contact.last_contact_date)
    date.setDate(date.getDate() + contact.desired_frequency_days)
    return date
  }

  function effectiveContactDate(contact: Contact) {
    const planned = nextContactDate(contact)
    if (!planned) return null
    if (!contact.snooze_until) return planned
    const snooze = parseDate(contact.snooze_until)
    return snooze > planned ? snooze : planned
  }

  function differenceDays(contact: Contact) {
    const targetDate = effectiveContactDate(contact)
    if (!targetDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(targetDate)
    target.setHours(0, 0, 0, 0)
    return Math.round((target.getTime() - today.getTime()) / 86400000)
  }

  function statusFor(contact: Contact): { label: string; type: StatusType } {
    const days = differenceDays(contact)
    if (days === null) return { label: 'Geen planning', type: 'none' }
    if (days < 0) {
      const n = Math.abs(days)
      return { label: `${n} ${n === 1 ? 'dag' : 'dagen'} te laat`, type: 'overdue' }
    }
    if (days === 0) return { label: 'Vandaag', type: 'today' }
    if (days === 1) return { label: 'Morgen', type: 'upcoming' }
    return { label: `Over ${days} dagen`, type: 'upcoming' }
  }

  function formatDate(value: Date | string | null) {
    if (!value) return 'Niet ingesteld'
    const date = typeof value === 'string' ? parseDate(value) : value
    return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  }

  function annualOccurrence(value: string | null) {
    if (!value) return null
    const source = parseDate(value)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let date = new Date(today.getFullYear(), source.getMonth(), source.getDate())
    if (date < today) date = new Date(today.getFullYear() + 1, source.getMonth(), source.getDate())
    return date
  }

  function urgency(contact: Contact) {
    return effectiveContactDate(contact)?.getTime() ?? Number.MAX_SAFE_INTEGER
  }

  function matchesStatus(contact: Contact) {
    const days = differenceDays(contact)
    if (statusFilter === 'all') return true
    if (statusFilter === 'overdue') return days !== null && days < 0
    if (statusFilter === 'today') return days === 0
    if (statusFilter === 'later') return days !== null && days > 0
    return days === null
  }

  function closeOnBackdrop(event: ReactMouseEvent<HTMLDivElement>, close: () => void) {
    if (event.target === event.currentTarget) close()
  }

  const groups = useMemo(
    () =>
      Array.from(new Set(contacts.map((c) => c.group_name).filter((g): g is string => Boolean(g))))
        .sort((a, b) => a.localeCompare(b, 'nl')),
    [contacts]
  )

  const filteredContacts = useMemo(() => {
    return contacts
      .filter((contact) => {
        const term = searchTerm.trim().toLowerCase()
        const searchOk =
          !term ||
          contact.name.toLowerCase().includes(term) ||
          (contact.notes ?? '').toLowerCase().includes(term) ||
          (contact.last_topic ?? '').toLowerCase().includes(term)
        const groupOk = groupFilter === 'Alle' || contact.group_name === groupFilter
        return searchOk && groupOk && matchesStatus(contact)
      })
      .sort((a, b) =>
        sortMode === 'name' ? a.name.localeCompare(b.name, 'nl') : urgency(a) - urgency(b)
      )
  }, [contacts, searchTerm, groupFilter, statusFilter, sortMode])

  const dueContacts = contacts
    .filter((c) => {
      const days = differenceDays(c)
      return days !== null && days <= 0
    })
    .sort((a, b) => urgency(a) - urgency(b))

  const nextSevenDays = contacts
    .filter((c) => {
      const days = differenceDays(c)
      return days !== null && days > 0 && days <= 7
    })
    .sort((a, b) => urgency(a) - urgency(b))

  const overdueCount = contacts.filter((c) => {
    const days = differenceDays(c)
    return days !== null && days < 0
  }).length
  const todayCount = contacts.filter((c) => differenceDays(c) === 0).length
  const laterCount = contacts.filter((c) => {
    const days = differenceDays(c)
    return days !== null && days > 0
  }).length
  const unplannedCount = contacts.filter((c) => differenceDays(c) === null).length

  const groupStats = groups
    .map((group) => ({ group, count: contacts.filter((c) => c.group_name === group).length }))
    .sort((a, b) => b.count - a.count)

  const birthdays = contacts
    .map((contact) => ({ contact, date: annualOccurrence(contact.birthday) }))
    .filter((x): x is { contact: Contact; date: Date } => Boolean(x.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6)

  const importantDates = contacts
    .map((contact) => ({ contact, date: annualOccurrence(contact.important_date) }))
    .filter((x): x is { contact: Contact; date: Date } => Boolean(x.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6)

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand">
            <h1>TikTact</h1>
            <p>Blijf in contact met de mensen die ertoe doen.</p>
          </div>

          <form className="form-stack" onSubmit={handleSignUp}>
            <label>
              E-mailadres
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Wachtwoord
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </label>
            <button className="primary-button" type="button" onClick={handleSignIn} disabled={loading}>Inloggen</button>
            <button className="secondary-button" type="submit" disabled={loading}>Account aanmaken</button>
          </form>

          {authMessage && <p className="feedback">{authMessage}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>TikTact</h1>
          <p className="subtitle">Blijf in contact met de mensen die ertoe doen.</p>
        </div>
        <button className="text-button" onClick={handleSignOut}>Uitloggen</button>
      </header>

      <nav className="top-nav" aria-label="Hoofdnavigatie">
        <button className={page === 'home' ? 'top-nav-item active' : 'top-nav-item'} onClick={() => setPage('home')}>Home</button>
        <button className={page === 'contacts' ? 'top-nav-item active' : 'top-nav-item'} onClick={() => setPage('contacts')}>Contacten</button>
        <button className={page === 'dashboard' ? 'top-nav-item active' : 'top-nav-item'} onClick={() => setPage('dashboard')}>Dashboard</button>
      </nav>

      {page === 'home' && (
        <>
          <section className="hero-panel">
            <span className="eyebrow">Home</span>
            <h2>Prioriteit vandaag</h2>
            <p>{dueContacts.length === 0 ? 'Je bent helemaal bij.' : `${dueContacts.length} contact(en) vragen aandacht.`}</p>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div><span className="eyebrow">Nu</span><h2>Vandaag</h2></div>
              <span className="count-badge">{dueContacts.length}</span>
            </div>

            {dueContacts.length === 0 ? (
              <div className="empty-state"><strong>Je bent helemaal bij ✓</strong><p>Niemand staat vandaag op de planning.</p></div>
            ) : (
              <div className="priority-list">
                {dueContacts.map((contact) => {
                  const status = statusFor(contact)
                  return (
                    <article className="priority-card" key={contact.id}>
                      <button className="priority-main" onClick={() => setSelectedContactId(contact.id)}>
                        <span><strong>{contact.name}</strong><small>{contact.group_name || 'Geen groep'}</small></span>
                        <span className={`status status-${status.type}`}>{status.label}</span>
                      </button>
                      {contact.last_topic && <p className="topic-line">Laatst besproken: {contact.last_topic}</p>}
                      <div className="quick-actions">
                        <button className="primary-button compact-button" onClick={() => void markContactHad(contact.id)}>Contact gehad</button>
                        <button className="secondary-button compact-button" onClick={() => void snoozeContact(contact.id)}>+7 dagen</button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div><span className="eyebrow">Vooruitblik</span><h2>Komende 7 dagen</h2></div>
              <span className="count-badge">{nextSevenDays.length}</span>
            </div>
            {nextSevenDays.length === 0 ? (
              <div className="empty-state"><strong>Rustige week</strong><p>Geen extra contactmomenten in de komende 7 dagen.</p></div>
            ) : (
              <div className="mini-list">
                {nextSevenDays.map((contact) => (
                  <button className="mini-row" key={contact.id} onClick={() => setSelectedContactId(contact.id)}>
                    <span><strong>{contact.name}</strong><small>{contact.group_name || 'Geen groep'}</small></span>
                    <span>{formatDate(effectiveContactDate(contact))}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {page === 'contacts' && (
        <>
          <section className="page-title-row">
            <div><span className="eyebrow">Contacten</span><h2>Mijn contacten</h2></div>
            <button className="add-button" aria-label="Nieuw contact" title="Nieuw contact" onClick={openNewContact}>+</button>
          </section>

          {contactMessage && <p className="feedback">{contactMessage}</p>}

          <section className="panel">
            <div className="status-tabs">
              {([
                ['all', `Alles ${contacts.length}`],
                ['overdue', `Te laat ${overdueCount}`],
                ['today', `Vandaag ${todayCount}`],
                ['later', `Later ${laterCount}`],
                ['none', `Geen planning ${unplannedCount}`],
              ] as [StatusFilter, string][]).map(([value, label]) => (
                <button key={value} className={statusFilter === value ? 'filter-chip active' : 'filter-chip'} onClick={() => setStatusFilter(value)}>{label}</button>
              ))}
            </div>

            <div className="filters">
              <input type="search" placeholder="Zoek naam, gesprek of notitie..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value="Alle">Alle groepen</option>
                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as 'urgency' | 'name')}>
                <option value="urgency">Meest urgent</option>
                <option value="name">Naam A-Z</option>
              </select>
            </div>

            <div className="contact-grid">
              {filteredContacts.map((contact) => {
                const status = statusFor(contact)
                return (
                  <button className="contact-card" key={contact.id} onClick={() => setSelectedContactId(contact.id)}>
                    <span className="contact-card-main">
                      <span><strong>{contact.name}</strong><small>{contact.group_name || 'Geen groep'}</small></span>
                      <span className={`status status-${status.type}`}>{status.label}</span>
                    </span>
                    <span className="contact-card-meta">Volgend contact: <strong>{formatDate(effectiveContactDate(contact))}</strong></span>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )}

      {page === 'dashboard' && (
        <>
          <section className="page-title-row"><div><span className="eyebrow">Dashboard</span><h2>Relatie-overzicht</h2></div></section>

          <section className="stats-grid">
            <div className="stat-card"><span>Totaal</span><strong>{contacts.length}</strong></div>
            <div className="stat-card"><span>Vandaag</span><strong>{todayCount}</strong></div>
            <div className="stat-card danger-stat"><span>Te laat</span><strong>{overdueCount}</strong></div>
            <div className="stat-card"><span>Later</span><strong>{laterCount}</strong></div>
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <span className="eyebrow">Groepen</span><h2>Verdeling</h2>
              <div className="metric-list">
                {groupStats.map((item) => <div className="metric-row" key={item.group}><span>{item.group}</span><strong>{item.count}</strong></div>)}
              </div>
            </article>

            <article className="panel">
              <span className="eyebrow">Komend</span><h2>Verjaardagen</h2>
              <div className="metric-list">
                {birthdays.map(({ contact, date }) => (
                  <button className="metric-row metric-button" key={contact.id} onClick={() => setSelectedContactId(contact.id)}>
                    <span>{contact.name}</span><strong>{formatDate(date)}</strong>
                  </button>
                ))}
              </div>
            </article>

            <article className="panel">
              <span className="eyebrow">Komend</span><h2>Belangrijke datums</h2>
              <div className="metric-list">
                {importantDates.map(({ contact, date }) => (
                  <button className="metric-row metric-button" key={contact.id} onClick={() => setSelectedContactId(contact.id)}>
                    <span>{contact.name}<small>{contact.important_date_label || 'Belangrijke datum'}</small></span><strong>{formatDate(date)}</strong>
                  </button>
                ))}
              </div>
            </article>
          </section>
        </>
      )}

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => closeOnBackdrop(event, closeForm)}>
          <section className="modal-card form-modal" role="dialog" aria-modal="true" aria-labelledby="contact-form-title">
            <div className="modal-header">
              <div><span className="eyebrow">{editingContactId ? 'Aanpassen' : 'Nieuw'}</span><h2 id="contact-form-title">{editingContactId ? 'Contact bewerken' : 'Contact toevoegen'}</h2></div>
              <button type="button" className="modal-close" aria-label="Sluiten" onClick={closeForm}>×</button>
            </div>

            <form className="contact-form" onSubmit={saveContact}>
              <label>Naam<input autoFocus value={contactName} onChange={(e) => setContactName(e.target.value)} required /></label>
              <label>Groep<input list="group-options" value={groupName} onChange={(e) => setGroupName(e.target.value)} /></label>
              <datalist id="group-options"><option value="Familie" /><option value="Vrienden" /><option value="Netwerk" />{groups.map((group) => <option key={group} value={group} />)}</datalist>
              <label>Laatste contact<input type="date" value={lastContactDate} onChange={(e) => setLastContactDate(e.target.value)} /></label>
              <label>Frequentie in dagen<input type="number" min="1" value={frequencyDays} onChange={(e) => setFrequencyDays(e.target.value)} /></label>
              <label>Verjaardag<input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></label>
              <label>Belangrijke datum<input type="date" value={importantDate} onChange={(e) => setImportantDate(e.target.value)} /></label>
              <label className="full-width">Omschrijving belangrijke datum<input value={importantDateLabel} onChange={(e) => setImportantDateLabel(e.target.value)} /></label>
              <label className="full-width">Waar laatst over gesproken<input value={lastTopic} onChange={(e) => setLastTopic(e.target.value)} /></label>
              <label className="full-width">Notities<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
              <div className="modal-actions full-width">
                <button className="primary-button" type="submit">{editingContactId ? 'Wijzigingen opslaan' : 'Contact opslaan'}</button>
                <button className="secondary-button" type="button" onClick={closeForm}>Annuleren</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedContact && (
        <div className="modal-backdrop" onMouseDown={(event) => closeOnBackdrop(event, () => setSelectedContactId(null))}>
          <section className="modal-card details-modal" role="dialog" aria-modal="true" aria-labelledby="contact-details-title">
            <div className="modal-header">
              <div>
                <span className="eyebrow">Contact</span>
                <h2 id="contact-details-title">{selectedContact.name}</h2>
                {selectedContact.group_name && <span className="group-badge">{selectedContact.group_name}</span>}
              </div>
              <button type="button" className="modal-close" aria-label="Sluiten" onClick={() => setSelectedContactId(null)}>×</button>
            </div>

            <div className="detail-status-row">
              <span className={`status status-${statusFor(selectedContact).type}`}>{statusFor(selectedContact).label}</span>
              {selectedContact.snooze_until && <span className="snooze-badge">Uitgesteld tot {formatDate(selectedContact.snooze_until)}</span>}
            </div>

            <dl className="details-grid">
              <div><dt>Laatste contact</dt><dd>{formatDate(selectedContact.last_contact_date)}</dd></div>
              <div><dt>Volgend contact</dt><dd>{formatDate(effectiveContactDate(selectedContact))}</dd></div>
              <div><dt>Frequentie</dt><dd>{selectedContact.desired_frequency_days ? `${selectedContact.desired_frequency_days} dagen` : 'Niet ingesteld'}</dd></div>
              <div><dt>Verjaardag</dt><dd>{formatDate(selectedContact.birthday)}</dd></div>
              <div><dt>{selectedContact.important_date_label || 'Belangrijke datum'}</dt><dd>{formatDate(selectedContact.important_date)}</dd></div>
              <div><dt>Groep</dt><dd>{selectedContact.group_name || 'Geen groep'}</dd></div>
            </dl>

            {selectedContact.last_topic && <section className="detail-block"><span className="detail-label">Laatst besproken</span><p>{selectedContact.last_topic}</p></section>}
            {selectedContact.notes && <section className="detail-block"><span className="detail-label">Notities</span><p>{selectedContact.notes}</p></section>}

            <div className="detail-actions">
              <button className="primary-button" onClick={() => void markContactHad(selectedContact.id)}>Contact gehad</button>
              <button className="secondary-button" onClick={() => void snoozeContact(selectedContact.id)}>+7 dagen</button>
              <button className="secondary-button" onClick={() => startEditing(selectedContact)}>Bewerken</button>
              <button className="danger-button" onClick={() => void deleteContact(selectedContact)}>Verwijderen</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
