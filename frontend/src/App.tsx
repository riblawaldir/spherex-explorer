import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ExplorerProvider } from "@/components/layout/ExplorerContext";
import { AboutPage } from "@/pages/AboutPage";
import { ComparisonPage } from "@/pages/ComparisonPage";
import { ExplorePage } from "@/pages/ExplorePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <ExplorerProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<ExplorePage />} />
          <Route path="/comparacion" element={<ComparisonPage />} />
          <Route path="/acerca" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </ExplorerProvider>
  );
}
