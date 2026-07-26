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

  try {
    const store = usersStore(event)
    const { blobs } = await store.list()
    const all = (
      await Promise.all(
        blobs
          .filter((b) => !b.key.startsWith('zz-'))
          .map((b) => store.get(b.key, { type: 'json' }).catch(() => null)),
      )
    ).filter(Boolean)

    // Отдаём всё разом — поиск/сортировка/фильтры/пагинация делаются на клиенте
    // и работают мгновенно, без запросов к серверу на каждый клик.
    all.sort((a, b) => String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')))
    const totalImports = all.reduce((s, u) => s + (u.imports || 0), 0)

    return json(200, {
      totalUsers: all.length,
      totalImports,
      users: all,
    })
  } catch (e) {
    console.error(e)
    return json(500, { error: 'Не удалось прочитать статистику' })
  }
}
