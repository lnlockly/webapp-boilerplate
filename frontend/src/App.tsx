import React from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import Home from './pages/Home.tsx';
import About from './pages/About.tsx';

/**
 * Canonical SPA layout. Slots:
 *   - brief.title        (document title, header brand)
 *   - brief.nav_home     (Home link label)
 *   - brief.nav_about    (About link label)
 * Plus per-page slots inside ./pages/*.tsx.
 *
 * Coder may add new <Route> entries but must keep <BrowserRouter> + the
 * Layout outlet intact so the platform's preview navigation works.
 *
 * Slot markers in JSX text children are wrapped as JS string literals
 * so the file parses as valid JSX even before finalizeSlotsInPod runs.
 */
function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">{'JWT SPA Dashboard + Stripe Billing'}</Link>
        <nav>
          <Link to="/">{'Home'}</Link>
          <Link to="/about">{'About'}</Link>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer>
        <small>Сделано на AgentFlow</small>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

