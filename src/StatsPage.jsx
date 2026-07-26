import { useEffect, useRef, useState } from 'react'

const KEY_STORAGE = 'tuit-gpa-admin-key'
const PER_PAGE = 10
const API = '/api/s-165b0620afce'

const SORTS = [
  ['lastSeen', 'Последний вход'],
  ['firstSeen', 'Первый вход'],
  ['login', 'Логин'],
  ['name', 'Имя'],
  ['imports', 'Импортов'],
  ['course', 'Курс'],
  ['group', 'Группа'],
  ['faculty', 'Факультет'],
]

const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function StatsPage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(KEY_STORAGE) || '')
  const [keyInput, setKeyInput] = useState('')
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Поиск, сортировка, фильтры.
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('lastSeen')
  const [dir, setDir] = useState('desc')
  const [fCourse, setFCourse] = useState('')
  const [fGroup, setFGroup] = useState('')
  const [fFaculty, setFFaculty] = useState('')
  const debounceRef = useRef(null)

  const load = async (key, params) => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({
        page: String(params.page),
        perPage: String(PER_PAGE),
        sort: params.sort,
        dir: params.dir,
      })
      if (params.q) query.set('q', params.q)
      if (params.course) query.set('course', params.course)
      if (params.group) query.set('group', params.group)
      if (params.faculty) query.set('faculty', params.faculty)

      const res = await fetch(`${API}?${query}`, { headers: { 'x-admin-key': key } })
      const body = await res.json().catch(() => ({}))
      if (res.status === 401) {
        localStorage.removeItem(KEY_STORAGE)
        setAdminKey('')
        setData(null)
        throw new Error('Неверный ключ доступа')
      }
      if (!res.ok) throw new Error(body.error || 'Сервер недоступен')
      setData(body)
      localStorage.setItem(KEY_STORAGE, key)
      setAdminKey(key)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Перезагрузка при смене страницы/сортировки/фильтров; поиск — с задержкой.
  useEffect(() => {
    if (!adminKey) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => load(adminKey, { page, q, sort, dir, course: fCourse, group: fGroup, faculty: fFaculty }),
      q ? 300 : 0,
    )
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, sort, dir, fCourse, fGroup, fFaculty, adminKey])

  const resetPage = (setter) => (value) => {
    setter(value)
    setPage(1)
  }
  const setQ1 = resetPage(setQ)
  const setSort1 = resetPage(setSort)
  const setDir1 = resetPage(setDir)
  const setCourse1 = resetPage(setFCourse)
  const setGroup1 = resetPage(setFGroup)
  const setFaculty1 = resetPage(setFFaculty)

  const hasFilters = q || fCourse || fGroup || fFaculty
  const clearFilters = () => {
    setQ('')
    setFCourse('')
    setFGroup('')
    setFFaculty('')
    setPage(1)
  }

  const submitKey = (e) => {
    e.preventDefault()
    if (keyInput.trim()) load(keyInput.trim(), { page: 1, q: '', sort, dir })
  }

  const facets = data?.facets || { courses: [], groups: [], faculties: [] }

  return (
    <div className="page stats-page">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="TUIT" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">GPA Calculator</span>
            <span className="brand-tag">статистика</span>
          </div>
        </div>
        <a className="btn btn-line" href="/">
          ← к калькулятору
        </a>
      </header>

      <div className="stats-wrap">
        {!adminKey && (
          <form className="panel stats-auth" onSubmit={submitKey}>
            <h2>Доступ к статистике</h2>
            <label className="fld">
              <span>Админ-ключ</span>
              <input
                type="password"
                autoFocus
                placeholder="••••••••"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
            </label>
            {error && <div className="alert">{error}</div>}
            <button className="btn btn-accent full" type="submit" disabled={loading}>
              {loading ? 'Проверяем…' : 'Войти'}
            </button>
          </form>
        )}

        {adminKey && (
          <>
            <div className="stats-cards">
              <div className="panel stat-card">
                <b>{data ? data.totalUsers ?? data.total : '…'}</b>
                <span>пользователей</span>
              </div>
              <div className="panel stat-card">
                <b>{data ? data.totalImports : '…'}</b>
                <span>импортов</span>
              </div>
            </div>

            <div className="panel stats-controls">
              <input
                className="stats-search"
                type="search"
                placeholder="Поиск по логину или имени…"
                value={q}
                onChange={(e) => setQ1(e.target.value)}
              />

              <div className="stats-filters">
                <label className="ctl">
                  <span>Сортировка</span>
                  <div className="ctl-row">
                    <select value={sort} onChange={(e) => setSort1(e.target.value)}>
                      {SORTS.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="dir-btn"
                      onClick={() => setDir1(dir === 'asc' ? 'desc' : 'asc')}
                      title={dir === 'asc' ? 'По возрастанию' : 'По убыванию'}
                    >
                      {dir === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </label>

                <label className="ctl">
                  <span>Курс</span>
                  <select value={fCourse} onChange={(e) => setCourse1(e.target.value)}>
                    <option value="">Все</option>
                    {facets.courses.map((c) => (
                      <option key={c} value={c}>
                        {c} курс
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ctl">
                  <span>Группа</span>
                  <select value={fGroup} onChange={(e) => setGroup1(e.target.value)}>
                    <option value="">Все</option>
                    {facets.groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ctl">
                  <span>Факультет</span>
                  <select value={fFaculty} onChange={(e) => setFaculty1(e.target.value)}>
                    <option value="">Все</option>
                    {facets.faculties.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                {hasFilters && (
                  <button type="button" className="btn btn-ghost ctl-clear" onClick={clearFilters}>
                    Сбросить
                  </button>
                )}
              </div>
            </div>

            {error && <div className="alert">{error}</div>}

            <div className="panel stats-panel">
              <div className="stats-head">
                <span className="su-idx">№</span>
                <span className="su-login">Логин</span>
                <span className="su-name">Имя</span>
                <span className="su-course">Курс</span>
                <span className="su-group">Группа</span>
                <span className="su-fac">Факультет</span>
                <span className="su-n">Имп.</span>
                <span className="su-date">Последний вход</span>
              </div>

              {loading && !data && <p className="stats-empty">Загрузка…</p>}
              {data && !data.users.length && (
                <p className="stats-empty">
                  {hasFilters ? 'Ничего не найдено' : 'Пока никто не входил'}
                </p>
              )}

              {data &&
                data.users.map((u, i) => (
                  <div className="stats-row" key={u.login}>
                    <span className="su-idx">{(data.page - 1) * data.perPage + i + 1}</span>
                    <span className="su-login">{u.login}</span>
                    <span className="su-name" title={u.name}>
                      {u.name || '—'}
                    </span>
                    <span className="su-course">{u.course || '—'}</span>
                    <span className="su-group">{u.group || '—'}</span>
                    <span className="su-fac" title={u.faculty}>
                      {u.faculty || '—'}
                    </span>
                    <span className="su-n">{u.imports || 0}</span>
                    <span className="su-date">{fmtDate(u.lastSeen)}</span>
                  </div>
                ))}

              {data && data.pages > 1 && (
                <div className="pager">
                  <button
                    className="btn btn-line"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Назад
                  </button>
                  <span className="pager-info">
                    {data.page} / {data.pages}
                  </span>
                  <button
                    className="btn btn-line"
                    disabled={page >= data.pages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Вперёд →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
