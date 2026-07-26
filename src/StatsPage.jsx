import { useEffect, useState } from 'react'

const KEY_STORAGE = 'tuit-gpa-admin-key'
const PER_PAGE = 10

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

  const load = async (key, p) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/stats?page=${p}&perPage=${PER_PAGE}`, {
        headers: { 'x-admin-key': key },
      })
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

  useEffect(() => {
    if (adminKey) load(adminKey, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const submitKey = (e) => {
    e.preventDefault()
    if (keyInput.trim()) load(keyInput.trim(), 1)
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
                <b>{data ? data.total : '…'}</b>
                <span>пользователей</span>
              </div>
              <div className="panel stat-card">
                <b>{data ? data.totalImports : '…'}</b>
                <span>импортов</span>
              </div>
            </div>

            {error && <div className="alert">{error}</div>}

            <div className="panel stats-panel">
              <div className="stats-head">
                <span className="su-idx">№</span>
                <span className="su-login">Логин</span>
                <span className="su-name">Имя</span>
                <span className="su-n">Импортов</span>
                <span className="su-date">Последний вход</span>
              </div>

              {loading && !data && <p className="stats-empty">Загрузка…</p>}
              {data && !data.users.length && <p className="stats-empty">Пока никто не входил</p>}

              {data &&
                data.users.map((u, i) => (
                  <div className="stats-row" key={u.login}>
                    <span className="su-idx">{(data.page - 1) * data.perPage + i + 1}</span>
                    <span className="su-login">{u.login}</span>
                    <span className="su-name">{u.name || '—'}</span>
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
