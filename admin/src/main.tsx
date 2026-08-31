import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminApp from './components/admin/AdminApp'
import './styles/global.css'

const root = document.getElementById('admin-root')
if (!root) throw new Error('#admin-root not found')

createRoot(root).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>
)
