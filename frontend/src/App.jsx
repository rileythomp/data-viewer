import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Agentation } from 'agentation'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'
import Sidebar from './components/Sidebar'
import AccountList from './components/AccountList'
import AccountDetail from './components/AccountDetail'
import GroupDetail from './components/GroupDetail'
import InstitutionDetail from './components/InstitutionDetail'
import SettingsPage from './components/SettingsPage'
import AccountsPage from './components/AccountsPage'
import DashboardList from './components/DashboardList'
import DashboardCreate from './components/DashboardCreate'
import DashboardDetail from './components/DashboardDetail'
import DatasetList from './components/DatasetList'
import DatasetCreate from './components/DatasetCreate'
import DatasetDetail from './components/DatasetDetail'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<AccountList />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/accounts/:id" element={<AccountDetail />} />
              <Route path="/groups/:id" element={<GroupDetail />} />
              <Route path="/institutions/:id" element={<InstitutionDetail />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/dashboards" element={<DashboardList />} />
              <Route path="/dashboards/new" element={<DashboardCreate />} />
              <Route path="/dashboards/:id" element={<DashboardDetail />} />
              <Route path="/datasets" element={<DatasetList />} />
              <Route path="/datasets/new" element={<DatasetCreate />} />
              <Route path="/datasets/:id" element={<DatasetDetail />} />
            </Routes>
          </main>
        </div>
        {import.meta.env.DEV && <Agentation />}
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
