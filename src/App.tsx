import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import DashboardPage from "@/pages/DashboardPage";
import WalletModal from "@/components/WalletModal";

export default function App() {
  return (
    <>
      <WalletModal />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
