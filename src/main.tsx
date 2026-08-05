// @ts-nocheck
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import SKLoveApp from "./sk-love/App";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminPanelPage } from "./pages/AdminPanelPage";
import { useKeepScreenAwake } from "./hooks/useKeepScreenAwake";
import "./styles.css";

const queryClient = new QueryClient();

function AppRoutes() {
  useKeepScreenAwake();

  return (
    <Routes>
      <Route path="/" element={<SKLoveApp />} />
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin-panel" element={<AdminPanelPage />} />
    </Routes>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>
);
