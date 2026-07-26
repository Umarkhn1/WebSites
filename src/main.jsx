import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import StatsPage from './StatsPage.jsx'
import './styles.css'

// Простейший роутинг: секретный путь — страница статистики, всё остальное — калькулятор.
const STATS_PATH = '/165b0620afce'
const isStats = window.location.pathname.replace(/\/+$/, '') === STATS_PATH

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isStats ? <StatsPage /> : <App />}</React.StrictMode>,
)
