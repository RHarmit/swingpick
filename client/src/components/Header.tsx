import { Link } from "wouter";
import { Sun, Moon, TrendingUp } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer" data-testid="logo-link">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-semibold text-sm tracking-tight">SwingPick</span>
              <span className="text-[10px] text-muted-foreground tracking-wide uppercase">NSE / BSE</span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground mr-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Market Open
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
            data-testid="theme-toggle"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
