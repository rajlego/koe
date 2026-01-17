import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";

// Lazy load ThoughtWindow for route-based code splitting
const ThoughtWindow = lazy(() => import("./components/ThoughtWindow/ThoughtWindow"));

// Simple loading fallback
function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-muted)',
      fontFamily: 'inherit'
    }}>
      Loading...
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/thought/:thoughtId" element={<ThoughtWindow />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
