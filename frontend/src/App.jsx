import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'
import NavBar from './components/NavBar'
import AccountList from './components/AccountList'
import AccountDetail from './components/AccountDetail'
import GroupDetail from './components/GroupDetail'
import SettingsPage from './components/SettingsPage'
import DashboardList from './components/DashboardList'
import DashboardCreate from './components/DashboardCreate'
import DashboardDetail from './components/DashboardDetail'
import ChartList from './components/ChartList'
import ChartCreate from './components/ChartCreate'
import ChartDetail from './components/ChartDetail'
import UploadList from './components/UploadList'
import UploadCreate from './components/UploadCreate'
import UploadDetail from './components/UploadDetail'
import DatasetList from './components/DatasetList'
import DatasetCreate from './components/DatasetCreate'
import DatasetDetail from './components/DatasetDetail'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<AccountList />} />
          <Route path="/accounts/:id" element={<AccountDetail />} />
          <Route path="/groups/:id" element={<GroupDetail />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dashboards" element={<DashboardList />} />
          <Route path="/dashboards/new" element={<DashboardCreate />} />
          <Route path="/dashboards/:id" element={<DashboardDetail />} />
          <Route path="/charts" element={<ChartList />} />
          <Route path="/charts/new" element={<ChartCreate />} />
          <Route path="/charts/:id" element={<ChartDetail />} />
          <Route path="/uploads" element={<UploadList />} />
          <Route path="/uploads/new" element={<UploadCreate />} />
          <Route path="/uploads/:id" element={<UploadDetail />} />
          <Route path="/datasets" element={<DatasetList />} />
          <Route path="/datasets/new" element={<DatasetCreate />} />
          <Route path="/datasets/:id" element={<DatasetDetail />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
