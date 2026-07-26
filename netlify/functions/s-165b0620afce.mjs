// Статистика для страницы /stats: количество пользователей и список с
// пагинацией. Доступ только по админ-ключу (переменная окружения ADMIN_KEY).

import { connectLambda, getStore } from '@netlify/blobs'

// Функции старого (lambda) формата не получают контекст Blobs автоматически —
// его нужно подключить из события через connectLambda.
export function usersStore(event) {
  connectLambda(event)
  return getStore('users')
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  const provided = event.headers['x-admin-key'] || ''
  if (!process.env.ADMIN_KEY || provided !== process.env.ADMIN_KEY) {
    return json(401, { error: 'Неверный ключ' })
  }

  const qs = event.queryStringParameters || {}
  const page = Math.max(1, parseInt(qs.page, 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(qs.perPage, 10) || 10))
  const q = String(qs.q || '').trim().toLowerCase()
  const sort = ['lastSeen', 'firstSeen', 'login', 'name', 'imports', 'course', 'group', 'faculty', 'gpa'].includes(qs.sort)
    ? qs.sort
    : 'lastSeen'
  const dir = qs.dir === 'asc' ? 1 : -1
  const fCourse = String(qs.course || '')
  const fGroup = String(qs.group || '').toLowerCase()
  const fFaculty = String(qs.faculty || '').toLowerCase()

  try {
    const store = usersStore(event)

    // Временная диагностика разметки /student/info.
    if (qs.debug === '1') {
      const dbg = await store.get('zz-debug-info', { type: 'json' }).catch(() => null)
      return json(200, dbg || { empty: true })
    }

    const { blobs } = await store.list()
    const all = (
      await Promise.all(
        blobs
          .filter((b) => !b.key.startsWith('zz-'))
          .map((b) => store.get(b.key, { type: 'json' }).catch(() => null)),
      )
    ).filter(Boolean)

    // Значения для фильтров — по полной базе, до применения фильтров.
    const facets = {
      courses: [...new Set(all.map((u) => u.course).filter(Boolean))].sort((a, b) => a - b),
      groups: [...new Set(all.map((u) => u.group).filter(Boolean))].sort(),
      faculties: [...new Set(all.map((u) => u.faculty).filter(Boolean))].sort(),
    }

    let users = all
    if (q) {
      users = users.filter(
        (u) =>
          String(u.login || '').toLowerCase().includes(q) ||
          String(u.name || '').toLowerCase().includes(q),
      )
    }
    if (fCourse) users = users.filter((u) => String(u.course || '') === fCourse)
    if (fGroup) users = users.filter((u) => String(u.group || '').toLowerCase() === fGroup)
    if (fFaculty) users = users.filter((u) => String(u.faculty || '').toLowerCase() === fFaculty)

    const numeric = sort === 'imports' || sort === 'course' || sort === 'gpa'
    users.sort((a, b) => {
      const va = a[sort]
      const vb = b[sort]
      const cmp = numeric
        ? (Number(va) || 0) - (Number(vb) || 0)
        : String(va || '').localeCompare(String(vb || ''), 'ru')
      return cmp * dir
    })

    const total = users.length
    const pages = Math.max(1, Math.ceil(total / perPage))
    const start = (page - 1) * perPage
    const totalImports = all.reduce((s, u) => s + (u.imports || 0), 0)

    return json(200, {
      total,
      totalUsers: all.length,
      totalImports,
      page,
      perPage,
      pages,
      facets,
      users: users.slice(start, start + perPage),
    })
  } catch (e) {
    console.error(e)
    return json(500, { error: 'Не удалось прочитать статистику' })
  }
}
