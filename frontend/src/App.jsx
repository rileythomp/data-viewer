import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'
import NavBar from './components/NavBar'
import AccountList from './components/AccountList'
import AccountDetail from './components/AccountDetail'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<AccountList />} />
          <Route path="/accounts/:id" element={<AccountDetail />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
