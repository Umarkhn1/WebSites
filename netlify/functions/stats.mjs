// Статистика для страницы /stats: количество пользователей и список с
// пагинацией. Доступ только по админ-ключу (переменная окружения ADMIN_KEY).

import { getStore } from '@netlify/blobs'

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

  try {
    const store = getStore('users')
    const { blobs } = await store.list()
    const users = (
      await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).catch(() => null)))
    ).filter(Boolean)

    users.sort((a, b) => String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')))

    const total = users.length
    const pages = Math.max(1, Math.ceil(total / perPage))
    const start = (page - 1) * perPage
    const totalImports = users.reduce((s, u) => s + (u.imports || 0), 0)

    return json(200, {
      total,
      totalImports,
      page,
      perPage,
      pages,
      users: users.slice(start, start + perPage),
    })
  } catch (e) {
    console.error(e)
    return json(500, { error: 'Не удалось прочитать статистику' })
  }
}
