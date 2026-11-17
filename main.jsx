import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { BrowserRouter } from 'react-router-dom'
import '@mantine/core/styles.css'
import './src/app.css'
import { AppProvider } from './src/context/AppContext.jsx'
import { ErrorBoundary } from './src/components/ErrorBoundary.jsx'
import { theme } from './src/theme.js'
import App from './src/App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppProvider>
            <App />
          </AppProvider>
        </BrowserRouter>
      </MantineProvider>
    </ErrorBoundary>
  </StrictMode>,
)
