import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import * as Sentry from '@sentry/react'
import { CartProvider } from './lib/cart.tsx'
import { Toaster } from './components/ui/sonner.tsx'
import './index.css'
import './i18n'
import App from './App.tsx'

// Prod-only, DSN-optional: mirrors the server's NODE_ENV=production gating.
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  })
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="es-market-theme"
          disableTransitionOnChange
        >
          <BrowserRouter>
            <CartProvider>
              <App />
              {/* top-center avoids the bottom-right floating chat widget button */}
              <Toaster position="top-center" />
            </CartProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
