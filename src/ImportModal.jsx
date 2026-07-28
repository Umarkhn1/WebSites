import { useEffect, useLayoutEffect, useRef, useState } from 'react'

function gpaOf(list) {
  let cr = 0
  let pts = 0
  for (const c of list) {
    if (c.grade) {
      // Оценка 2 — предмет аннулирован: кредит идёт в знаменатель, баллы не начисляются.
      cr += c.credit
      if (Number(c.grade) !== 2) pts += c.credit * c.grade
    }
  }
  return cr ? pts / cr : 0
}

// Семестры → курсы (в каждом курсе два семестра).
function groupCourses(semesters) {
  const courses = []
  for (let i = 0; i < semesters.length; i += 2) {
    courses.push({ course: i / 2 + 1, semesters: semesters.slice(i, i + 2) })
  }
  return courses
}

const flatten = (course) => course.semesters.flatMap((s) => s.courses)

export default function ImportModal({ t, session, onClose, onApply, onAuth, onExpire }) {
  const [step, setStep] = useState(session ? 'loading' : 'login')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [courses, setCourses] = useState([])
  const [sel, setSel] = useState(0)
  const [dir, setDir] = useState(1) // направление перехода: 1 вперёд, -1 назад
  const tabsRef = useRef(null)
  const [ind, setInd] = useState({ left: 0, width: 0 })

  // Плавно двигаем подсветку под активный курс, измеряя реальную позицию кнопки.
  useLayoutEffect(() => {
    const box = tabsRef.current
    if (!box) return
    const active = box.querySelector('.course-tab.active')
    if (active) setInd({ left: active.offsetLeft, width: active.offsetWidth })
  }, [sel, courses])

  const pickCourse = (i) => {
    if (i === sel) return
    setDir(i > sel ? 1 : -1)
    setSel(i)
  }

  const handleData = (data) => {
    const grouped = groupCourses(data.semesters)
    let def = grouped.length - 1
    grouped.forEach((c, i) => {
      if (c.semesters.some((s) => s.courses.some((x) => x.grade))) def = i
    })
    setCourses(grouped)
    setSel(def)
    onAuth(data.session, data.student)
    setStep('pick')
  }

  const request = async (payload) => {
    const res = await fetch('/api/lms/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      throw new Error(t.errServer)
    }
    return { res, data }
  }

  // Автовход по сохранённой сессии — без повторного ввода пароля.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      try {
        const { res, data } = await request({ session })
        if (cancelled) return
        if (res.status === 401 || data.expired) {
          onExpire()
          setStep('login')
          return
        }
        if (!res.ok || !data.semesters?.length) throw new Error(data.error || t.errServer)
        handleData(data)
      } catch (err) {
        if (!cancelled) {
          onExpire()
          setStep('login')
          setError(err.message || t.errServer)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { res, data } = await request({ login: login.trim(), password })
      if (res.status === 401) throw new Error(t.errWrong)
      if (res.status === 400) throw new Error(t.errEmpty)
      if (!res.ok || !data.semesters?.length) throw new Error(data.error || t.errServer)
      handleData(data)
    } catch (err) {
      setError(err.message || t.errServer)
    } finally {
      setLoading(false)
    }
  }

  const current = courses[sel]
  const courseGpa = current ? gpaOf(flatten(current)) : 0
  const totalList = courses.slice(0, sel + 1).flatMap(flatten)
  const totalGpa = gpaOf(totalList)
  const courseGraded = current ? flatten(current).filter((c) => c.grade).length : 0
  const totalGraded = totalList.filter((c) => c.grade).length

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{step === 'pick' ? t.modalPick : t.modalImport}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="×">
            ✕
          </button>
        </div>

        {step === 'loading' && (
          <div className="modal-body modal-loading">
            <div className="spinner" />
            <p className="modal-hint">{t.loading}</p>
          </div>
        )}

        {step === 'login' && (
          <form className="modal-body" onSubmit={submit}>
            <p className="modal-hint">{t.hintLogin}</p>
            <label className="fld">
              <span>{t.login}</span>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                placeholder={t.loginPh}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </label>
            <label className="fld">
              <span>{t.password}</span>
              <div className="pass-wrap">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t.passPh}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? t.hidePass : t.showPass}
                  title={showPass ? t.hidePass : t.showPass}
                >
                  {showPass ? (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {error && <div className="alert">{error}</div>}

            <button className="btn btn-accent full" type="submit" disabled={loading}>
              {loading ? t.submitting : t.submit}
            </button>
            <p className="modal-note">{t.privacy}</p>
          </form>
        )}

        {step === 'pick' && current && (
          <div className="modal-body">
            <div className="course-tabs" ref={tabsRef}>
              <span
                className="course-tab-ind"
                style={{ transform: `translateX(${ind.left}px)`, width: ind.width }}
              />
              {courses.map((c, i) => (
                <button
                  key={c.course}
                  className={'course-tab' + (i === sel ? ' active' : '')}
                  onClick={() => pickCourse(i)}
                >
                  {t.courseLabel(c.course)}
                </button>
              ))}
            </div>

            <div className="course-pane" key={sel} style={{ '--dir': dir }}>
              <div className="gpa-summary">
                <div className="gpa-box">
                  <span className="gpa-box-label">{t.courseGpa}</span>
                  <span className="gpa-box-val">{courseGraded ? courseGpa.toFixed(2) : '—'}</span>
                </div>
                <div className="gpa-box accent">
                  <span className="gpa-box-label">{t.totalGpa}</span>
                  <span className="gpa-box-val">{totalGraded ? totalGpa.toFixed(2) : '—'}</span>
                </div>
              </div>

              <p className="modal-hint">{t.hintPick}</p>
              <div className="sem-list">
                {current.semesters.map((s) => {
                  const g = gpaOf(s.courses)
                  const gradedN = s.courses.filter((x) => x.grade).length
                  return (
                    <button key={s.num} className="sem-item" onClick={() => onApply(s.courses)}>
                      <span className="sem-num">{s.num}</span>
                      <span className="sem-info">
                        <span className="sem-label">{t.semLabel(s.num)}</span>
                        <span className="sem-sub">
                          {t.subjects(s.courses.length)}
                          {gradedN < s.courses.length ? ` · ${t.graded(gradedN)}` : ''}
                        </span>
                      </span>
                      <span className="sem-gpa">{gradedN ? g.toFixed(2) : '—'}</span>
                    </button>
                  )
                })}
              </div>

              <button className="btn btn-accent full" onClick={() => onApply(totalList)}>
                {t.importAll(current.course)}
              </button>
            </div>

            <button
              className="modal-logout"
              onClick={() => {
                onExpire()
                setCourses([])
                setLogin('')
                setPassword('')
                setError('')
                setStep('login')
              }}
            >
              {t.logout}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
