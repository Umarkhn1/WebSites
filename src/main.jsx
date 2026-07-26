import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import StatsPage from './StatsPage.jsx'
import './styles.css'

// Простейший роутинг: /stats — страница статистики, всё остальное — калькулятор.
const isStats = window.location.pathname.replace(/\/+$/, '') === '/stats'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isStats ? <StatsPage /> : <App />}</React.StrictMode>,
)
