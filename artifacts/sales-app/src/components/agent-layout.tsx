import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Home, LogOut, PhoneCall, CalendarClock, BookUser } from "lucide-react";
import { Button } from "./ui/button";

const NAV_ITEMS = [
  { href: "/home",       label: "Home",      icon: Home },
  { href: "/calls/new",  label: "Calls",     icon: PhoneCall },
  { href: "/schedule",   label: "Schedule",  icon: CalendarClock },
  { href: "/customers",  label: "Customers", icon: BookUser },
];

export function AgentLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-card border-b sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sm">{user?.name}</div>
            <div className="text-xs text-muted-foreground">Sales Agent</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-4 w-4 text-muted-foreground" />
        </Button>
      </header>

      <main className="flex-1 pb-20 min-h-0">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-10 flex justify-around items-center py-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || location.startsWith(href + "/");
          return (
            <Link key={href} href={href}>
              <div
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "fill-primary/10" : ""}`} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
