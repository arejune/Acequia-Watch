import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './app/session'
import { DemoBanner, ToastProvider } from './components/ui'
import { ConfirmProvider, ScreenSkeleton } from './components/native'
import { AppShell, homeFor } from './app/AppShell'
import { SignIn } from './app/SignIn'
import { Welcome, isOnboarded } from './app/Welcome'
import { More } from './app/More'
import { Home } from './app/steward/Home'
import { AssessList } from './app/steward/AssessList'
import { AssessForm } from './app/steward/AssessForm'
import { QuickReport } from './app/steward/QuickReport'
import { Inventory, StructureForm } from './app/steward/Inventory'
import { SyncCenter } from './app/steward/SyncCenter'
import { MyReports } from './app/steward/MyReports'
import { FieldMap } from './app/MapTab'

// read-only pages load on demand to keep the field app light
const Learn = lazy(() => import('./app/learn/Learn'))
const Quiz = lazy(() => import('./app/learn/Quiz'))
const AgencyOverview = lazy(() => import('./app/agency/Overview'))
const AgencyReports = lazy(() => import('./app/agency/Reports'))
const Admin = lazy(() => import('./app/agency/Admin'))
const Packet = lazy(() => import('./app/packet/Packet'))
const Explore = lazy(() => import('./app/community/Explore'))
const Act = lazy(() => import('./app/community/Act'))
const IssueDetail = lazy(() => import('./app/community/Act').then((m) => ({ default: m.IssueDetail })))
const Write = lazy(() => import('./app/community/Act').then((m) => ({ default: m.Write })))
const Play = lazy(() => import('./app/community/Play'))

function Landing() {
  const { profile, ready } = useSession()
  if (!ready) return null
  if (profile) return <Navigate to={homeFor(profile.role)} replace />
  return <Navigate to={isOnboarded() ? '/explore' : '/welcome'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <ConfirmProvider>
            <a href="#main" className="sr-only">Skip to content</a>
            <DemoBanner />
            <Suspense fallback={<div className="screen-pad"><ScreenSkeleton /></div>}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/packet/:eventId/:acequiaId" element={<Packet />} />
                <Route element={<AppShell />}>
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/act" element={<Act />} />
                  <Route path="/act/issue/:id" element={<IssueDetail />} />
                  <Route path="/act/write" element={<Write />} />
                  <Route path="/play" element={<Play />} />
                  <Route path="/learn" element={<Learn />} />
                  <Route path="/learn/quiz" element={<Quiz />} />
                  <Route path="/map" element={<FieldMap />} />
                  <Route path="/more" element={<More />} />
                  <Route path="/steward" element={<Home />} />
                  <Route path="/steward/assess" element={<AssessList />} />
                  <Route path="/steward/quick" element={<QuickReport />} />
                  <Route path="/steward/report/:id" element={<AssessForm />} />
                  <Route path="/steward/inventory" element={<Inventory />} />
                  <Route path="/steward/inventory/:id" element={<StructureForm />} />
                  <Route path="/steward/reports" element={<MyReports />} />
                  <Route path="/steward/sync" element={<SyncCenter />} />
                  <Route path="/agency" element={<AgencyOverview />} />
                  <Route path="/agency/reports" element={<AgencyReports />} />
                  <Route path="/admin" element={<Admin />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ConfirmProvider>
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  )
}
