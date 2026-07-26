import { useEffect, useMemo, useState } from 'react'

const KEY_STORAGE = 'tuit-gpa-admin-key'
const PER_PAGE = 10
const API = '/api/s-165b0620afce'

// Колонки таблицы: ключ, заголовок, числовая ли сортировка, класс ячейки.
const COLS = [
  { key: 'login', label: 'Логин', num: false, cls: 'su-login' },
  { key: 'name', label: 'Имя', num: false, cls: 'su-name' },
  { key: 'course', label: 'Курс', num: true, cls: 'su-course' },
  { key: 'group', label: 'Группа', num: false, cls: 'su-group' },
  { key: 'faculty', label: 'Направление', num: false, cls: 'su-fac' },
  { key: 'gpa', label: 'GPA', num: true, cls: 'su-gpa' },
  { key: 'imports', label: 'Имп.', num: true, cls: 'su-n' },
  { key: 'lastSeen', label: 'Последний вход', num: false, cls: 'su-date' },
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

const cellValue = (u, key) => {
  if (key === 'lastSeen') return fmtDate(u.lastSeen)
  if (key === 'gpa') return u.gpa ? Number(u.gpa).toFixed(2) : '—'
  return u[key] || (key === 'imports' ? 0 : '—')
}

export default function StatsPage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(KEY_STORAGE) || '')
  const [keyInput, setKeyInput] = useState('')
  const [all, setAll] = useState(null) // все записи, загружаются один раз
  const [totalImports, setTotalImports] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Поиск, сортировка, фильтры, страница — всё обрабатывается локально.
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('lastSeen')
  const [dir, setDir] = useState('desc')
  const [fCourse, setFCourse] = useState('')
  const [fGroup, setFGroup] = useState('')
  const [fFaculty, setFFaculty] = useState('')
  const [page, setPage] = useState(1)

  const load = async (key) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API, { headers: { 'x-admin-key': key } })
      const body = await res.json().catch(() => ({}))
      if (res.status === 401) {
        localStorage.removeItem(KEY_STORAGE)
        setAdminKey('')
        setAll(null)
        throw new Error('Неверный ключ доступа')
      }
      if (!res.ok) throw new Error(body.error || 'Сервер недоступен')
      setAll(body.users || [])
      setTotalImports(body.totalImports || 0)
      localStorage.setItem(KEY_STORAGE, key)
      setAdminKey(key)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminKey) load(adminKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Значения фильтров — из полной базы.
  const facets = useMemo(() => {
    const list = all || []
    return {
      courses: [...new Set(list.map((u) => u.course).filter(Boolean))].sort((a, b) => a - b),
      groups: [...new Set(list.map((u) => u.group).filter(Boolean))].sort(),
      faculties: [...new Set(list.map((u) => u.faculty).filter(Boolean))].sort(),
    }
  }, [all])

  // Поиск + фильтры + сортировка — мгновенно на клиенте.
  const filtered = useMemo(() => {
    let list = all || []
    const query = q.trim().toLowerCase()
    if (query) {
      list = list.filter(
        (u) =>
          String(u.login || '').toLowerCase().includes(query) ||
          String(u.name || '').toLowerCase().includes(query),
      )
    }
    if (fCourse) list = list.filter((u) => String(u.course || '') === fCourse)
    if (fGroup) list = list.filter((u) => u.group === fGroup)
    if (fFaculty) list = list.filter((u) => u.faculty === fFaculty)

    const col = COLS.find((c) => c.key === sort)
    const mul = dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = a[sort]
      const vb = b[sort]
      const cmp = col?.num
        ? (Number(va) || 0) - (Number(vb) || 0)
        : String(va || '').localeCompare(String(vb || ''), 'ru')
      return cmp * mul
    })
  }, [all, q, fCourse, fGroup, fFaculty, sort, dir])

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const curPage = Math.min(page, pages)
  const pageRows = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE)

  // Сброс на первую страницу при любом изменении фильтров/сортировки.
  useEffect(() => {
    setPage(1)
  }, [q, fCourse, fGroup, fFaculty, sort, dir])

  const toggleSort = (key) => {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setDir('asc')
    }
  }

  const hasFilters = q || fCourse || fGroup || fFaculty
  const clearFilters = () => {
    setQ('')
    setFCourse('')
    setFGroup('')
    setFFaculty('')
  }

  const submitKey = (e) => {
    e.preventDefault()
    if (keyInput.trim()) load(keyInput.trim())
  }

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
                <b>{all ? all.length : '…'}</b>
                <span>пользователей</span>
              </div>
              <div className="panel stat-card">
                <b>{all ? totalImports : '…'}</b>
                <span>импортов</span>
              </div>
            </div>

            <div className="panel stats-controls">
              <input
                className="stats-search"
                type="search"
                placeholder="Поиск по логину или имени…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select className="ctl-select" value={fCourse} onChange={(e) => setFCourse(e.target.value)}>
                <option value="">Все курсы</option>
                {facets.courses.map((c) => (
                  <option key={c} value={c}>
                    {c} курс
                  </option>
                ))}
              </select>
              <select className="ctl-select" value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
                <option value="">Все группы</option>
                {facets.groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select className="ctl-select" value={fFaculty} onChange={(e) => setFFaculty(e.target.value)}>
                <option value="">Все направления</option>
                {facets.faculties.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button type="button" className="btn btn-ghost ctl-clear" onClick={clearFilters}>
                  Сбросить
                </button>
              )}
            </div>

            {error && <div className="alert">{error}</div>}

            <div className="panel stats-panel">
              <div className="stats-scroll">
                <div className="stats-head">
                  <span className="su-idx">№</span>
                  {COLS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={'th-sort ' + c.cls + (sort === c.key ? ' active' : '')}
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                      <span className="th-arrow">
                        {sort === c.key ? (dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  ))}
                </div>

                {!all && loading && <p className="stats-empty">Загрузка…</p>}
                {all && !pageRows.length && (
                  <p className="stats-empty">
                    {hasFilters ? 'Ничего не найдено' : 'Пока никто не входил'}
                  </p>
                )}

                {pageRows.map((u, i) => (
                  <div className="stats-row" key={u.login}>
                    <span className="su-idx">{(curPage - 1) * PER_PAGE + i + 1}</span>
                    {COLS.map((c) => (
                      <span key={c.key} className={c.cls} title={String(cellValue(u, c.key))}>
                        {cellValue(u, c.key)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              {pages > 1 && (
                <div className="pager">
                  <button
                    className="btn btn-line"
                    disabled={curPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Назад
                  </button>
                  <span className="pager-info">
                    {curPage} / {pages}
                  </span>
                  <button
                    className="btn btn-line"
                    disabled={curPage >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
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
