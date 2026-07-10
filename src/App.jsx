import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import VolunteerSignup from './pages/VolunteerSignup.jsx'
import OrgSignup from './pages/OrgSignup.jsx'
import OrgApply from './pages/OrgApply.jsx'
import Browse from './pages/Browse.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LogHours from './pages/LogHours.jsx'
import VerifyIdentity from './pages/VerifyIdentity.jsx'
import AdminReview from './pages/AdminReview.jsx'
import AdminOrgApplications from './pages/AdminOrgApplications.jsx'
import SignIn from './pages/SignIn.jsx'
import Support from './pages/Support.jsx'
import PostOpportunity from './pages/PostOpportunity.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="signup" element={<VolunteerSignup />} />
        <Route path="signin" element={<SignIn />} />
        <Route path="organizations" element={<OrgSignup />} />
        <Route path="organizations/apply" element={<OrgApply />} />
        <Route path="opportunities" element={<Browse />} />
        <Route path="support" element={<Support />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="log-hours"
          element={
            <ProtectedRoute>
              <LogHours />
            </ProtectedRoute>
          }
        />
        <Route
          path="verify-identity"
          element={
            <ProtectedRoute>
              <VerifyIdentity />
            </ProtectedRoute>
          }
        />
        <Route
          path="org/post"
          element={
            <ProtectedRoute>
              <PostOpportunity />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute>
              <AdminReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/org-applications"
          element={
            <ProtectedRoute>
              <AdminOrgApplications />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <div className="mx-auto max-w-6xl px-4 py-24 text-center">
              <p className="text-6xl font-extrabold text-primary-200">404</p>
              <p className="mt-3 text-lg font-semibold text-ink-700">
                That page didn&apos;t show up.
              </p>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
