import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'
import NavBar from './components/NavBar'
import AccountList from './components/AccountList'
import AccountDetail from './components/AccountDetail'
import GroupDetail from './components/GroupDetail'
import SettingsPage from './components/SettingsPage'

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
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
