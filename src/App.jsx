import { useState } from 'react'
import Sidebar   from './components/Sidebar.jsx'
import Toast     from './components/Toast.jsx'
import Dashboard from './components/Dashboard.jsx'
import Orders    from './components/Orders.jsx'
import NewOrder  from './components/NewOrder.jsx'
import Clients   from './components/Clients.jsx'
import Catalog   from './components/Catalog.jsx'

export default function App() {
  const [view,    setView]  = useState('dashboard')
  const [toast,   setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  const pages = { Dashboard, Orders, NewOrder, Clients, Catalog }
  const Page  = {
    dashboard : Dashboard,
    orders    : Orders,
    new_order : NewOrder,
    clients   : Clients,
    catalog   : Catalog,
  }[view] || Dashboard

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar view={view} setView={setView} />

      <main style={{ flex:1, overflow:'auto', background:'#0d1710' }}>
        <Page setView={setView} showToast={showToast} />
      </main>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
