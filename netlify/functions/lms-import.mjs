// Netlify serverless-функция: авторизуется в lms.tuit.uz (по логину/паролю или по
// сохранённой сессии) и возвращает учебный план + имя студента + строку сессии.
// Сессия позволяет повторно импортировать без повторного ввода пароля.

import { usersStore } from './s-165b0620afce.mjs'

const LMS = 'https://lms.tuit.uz'
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

function mergeCookies(store, setCookies) {
  for (const sc of setCookies) {
    const [pair] = sc.split(';')
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    store.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
  }
}
const cookieHeader = (store) =>
  [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; ')

function cookiesFromString(str) {
  const store = new Map()
  for (const part of String(str).split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    store.set(part.slice(0, idx).trim(), part.slice(idx + 1).trim())
  }
  return store
}

function getSetCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie()
  const raw = res.headers.get('set-cookie')
  return raw ? [raw] : []
}

const strip = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

function parseStudyPlan(html) {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || []
  const semesters = []
  tables.forEach((table, i) => {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/g) || []
    const courses = []
    for (const row of rows) {
      const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map(strip)
      if (cells.length < 3) continue
      if (/дисциплина/i.test(cells[0])) continue
      // Убираем скобки: «Исчисление (Calculus) (6 kr)» → «Исчисление».
      const name = cells[0].replace(/\s*\([^)]*\)/g, '').trim()
      const credit = parseInt(cells[1], 10)
      const grade = /^[2-5]$/.test(cells[2]) ? parseInt(cells[2], 10) : null
      if (!name || Number.isNaN(credit)) continue
      courses.push({ name, credit, grade })
    }
    if (courses.length) {
      semesters.push({ num: roman[i] || String(i + 1), courses })
    }
  })
  return semesters
}

function parseStudent(html) {
  const m = html.match(/si-student-name"[^>]*>([^<]+)</)
  const full = m ? strip(m[1]) : ''
  const tokens = full.split(/\s+/).filter(Boolean)
  // Формат: Фамилия Имя Отчество [o‘g‘li/qizi] → имя это второе слово.
  const name = tokens[1] || tokens[0] || ''

  // Профиль: ищем пары «метка → значение» в строках таблиц (ru/uz/en метки).
  let group = ''
  let faculty = ''
  let course = ''
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || []
  for (const row of rows) {
    const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map(strip)
    if (cells.length < 2) continue
    const label = cells[0].toLowerCase()
    const value = cells.slice(1).find(Boolean) || ''
    if (!value) continue
    if (!faculty && /факультет|fakultet|faculty/.test(label)) faculty = value
    else if (!group && /группа|guruh|group/.test(label)) group = value
    else if (!course && /курс|kurs|bosqich|course/.test(label)) course = value
  }
  // Запасной вариант: классы вида si-student-group / si-student-faculty.
  if (!group) {
    const g = html.match(/si-student-group"[^>]*>([^<]+)</)
    if (g) group = strip(g[1])
  }
  if (!faculty) {
    const f = html.match(/si-student-faculty"[^>]*>([^<]+)</)
    if (f) faculty = strip(f[1])
  }
  const courseNum = parseInt(String(course).match(/\d+/)?.[0], 10)
  return { full, name, group, faculty, course: Number.isNaN(courseNum) ? '' : courseNum }
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})

// Журнал пользователей для страницы /stats: логин, имя, время первого и
// последнего входа, число импортов. Пароли не сохраняются никогда.
// Накопительный GPA с 1 курса по текущий (все семестры с оценками).
// Правило аннулирования: оценка 2 — кредит в знаменатель, баллы не в числитель.
function overallGpa(semesters) {
  let cr = 0
  let pts = 0
  for (const s of semesters) {
    for (const c of s.courses) {
      if (!c.grade) continue
      cr += c.credit
      if (c.grade !== 2) pts += c.credit * c.grade
    }
  }
  return cr ? Math.round((pts / cr) * 100) / 100 : 0
}

async function recordUser(event, loginId, student, semesters) {
  try {
    const store = usersStore(event)
    const key = String(loginId).trim().toLowerCase()
    if (!key) return
    const now = new Date().toISOString()
    const prev = await store.get(key, { type: 'json' }).catch(() => null)
    // Курс: из профиля, иначе по числу семестров с оценками (2 семестра = курс).
    const gradedSem = semesters.filter((s) => s.courses.some((c) => c.grade)).length
    const course = student.course || prev?.course || Math.max(1, Math.ceil(gradedSem / 2))
    const gpa = overallGpa(semesters)
    await store.setJSON(key, {
      login: key,
      name: student.full || student.name || prev?.name || '',
      group: student.group || prev?.group || '',
      faculty: student.faculty || prev?.faculty || '',
      course,
      gpa,
      firstSeen: prev?.firstSeen || now,
      lastSeen: now,
      imports: (prev?.imports || 0) + 1,
    })
  } catch (e) {
    // Статистика не должна ломать импорт.
    console.error('recordUser failed:', e.message)
  }
}

async function login(cookies, loginId, password) {
  const page = await fetch(`${LMS}/auth/login`, {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  })
  mergeCookies(cookies, getSetCookie(page))
  const html = await page.text()
  const token = html.match(/name="_token"\s+value="([^"]+)"/)
  if (!token) return { error: 502 }

  const form = new URLSearchParams()
  form.set('_token', token[1])
  form.set('login', loginId)
  form.set('password', password)
  form.set('g-recaptcha-response', '')

  const auth = await fetch(`${LMS}/auth/login`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${LMS}/auth/login`,
      Cookie: cookieHeader(cookies),
    },
    body: form.toString(),
    redirect: 'manual',
  })
  mergeCookies(cookies, getSetCookie(auth))
  const location = auth.headers.get('location') || ''
  if (auth.status !== 302 || /auth\/login/.test(location)) return { error: 401 }
  return { ok: true }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  let login_, password, session
  try {
    ;({ login: login_, password, session } = JSON.parse(event.body || '{}'))
  } catch {
    return json(400, { error: 'Неверный запрос' })
  }

  try {
    let cookies
    if (session) {
      // Повторный импорт по сохранённой сессии — пароль не нужен.
      cookies = cookiesFromString(session)
    } else {
      if (!login_ || !password) return json(400, { error: 'Введите логин и пароль' })
      cookies = new Map()
      const res = await login(cookies, login_, password)
      if (res.error === 401) return json(401, { error: 'Неверный логин или пароль' })
      if (res.error) return json(502, { error: 'Не удалось войти в LMS' })
    }

    // Учебный план.
    const planRes = await fetch(`${LMS}/student/study-plan`, {
      headers: { 'User-Agent': UA, Cookie: cookieHeader(cookies) },
      redirect: 'manual',
    })
    if (planRes.status !== 200) {
      // Просроченная/битая сессия — просим войти заново.
      if (session) return json(401, { expired: true, error: 'Сессия истекла' })
      return json(502, { error: 'Не удалось открыть учебный план' })
    }
    const semesters = parseStudyPlan(await planRes.text())
    if (!semesters.length) return json(502, { error: 'Оценки не найдены' })

    // Имя студента.
    let student = { full: '', name: '' }
    try {
      const infoRes = await fetch(`${LMS}/student/info`, {
        headers: { 'User-Agent': UA, Cookie: cookieHeader(cookies) },
        redirect: 'manual',
      })
      if (infoRes.status === 200) student = parseStudent(await infoRes.text())
    } catch {}

    if (login_) await recordUser(event, login_, student, semesters)

    return json(200, { semesters, student, session: cookieHeader(cookies) })
  } catch (e) {
    console.error(e)
    return json(500, { error: 'Ошибка соединения с LMS' })
  }
}
