import { useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import Screener from "@/pages/screener";
import StockDetail from "@/pages/stock-detail";
import NotFound from "@/pages/not-found";

// Keep Render backend alive while any tab has the app open
const RENDER_URL = "https://swingpick.onrender.com";
function useKeepAlive() {
  useEffect(() => {
    const ping = () => fetch(`${RENDER_URL}/api/status`).catch(() => {});
    ping(); // initial ping
    const id = setInterval(ping, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(id);
  }, []);
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Screener} />
      <Route path="/stock/:symbol" component={StockDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useKeepAlive();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
