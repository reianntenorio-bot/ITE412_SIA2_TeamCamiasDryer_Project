import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Scheduler from './pages/Scheduler'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import ManageProducts from './pages/ManageProducts'
import Transactions from './pages/Transactions'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(Boolean(user))
      setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  if (authLoading) return null

  const handleLogout = () => {
    if (auth) signOut(auth)
  }

  const ProtectedLayout = ({ children }) => (
    <Layout onLogout={handleLogout}>
      {children}
    </Layout>
  )

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Login onLogin={() => {}} />
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            isAuthenticated ? 
              <ProtectedLayout><Dashboard /></ProtectedLayout> : 
              <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/history" 
          element={
            isAuthenticated ? 
              <ProtectedLayout><History /></ProtectedLayout> : 
              <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/scheduler" 
          element={
            isAuthenticated ? 
              <ProtectedLayout><Scheduler /></ProtectedLayout> : 
              <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/notifications" 
          element={
            isAuthenticated ? 
              <ProtectedLayout><Notifications /></ProtectedLayout> : 
              <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/settings" 
          element={
            isAuthenticated ? 
              <ProtectedLayout><Settings /></ProtectedLayout> : 
              <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/manage-products" 
          element={
            isAuthenticated ? 
              <ProtectedLayout><ManageProducts /></ProtectedLayout> : 
              <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/transactions" 
          element={
            isAuthenticated ? 
              <ProtectedLayout><Transactions /></ProtectedLayout> : 
              <Navigate to="/login" replace />
          } 
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App
