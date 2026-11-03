import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './AuthContext.jsx'
import Layout from './components/Layout.jsx'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
