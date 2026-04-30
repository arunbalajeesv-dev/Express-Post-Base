import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Home, BookUser, ListTodo, UserCheck, LogOut } from "lucide-react";
import { Button } from "./ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard",  icon: Home },
  { href: "/customers", label: "Customers",  icon: BookUser },
  { href: "/followups", label: "Follow-ups", icon: ListTodo },
  { href: "/users",     label: "Team",       icon: UserCheck },
];

function isNavActive(href: string, location: string): boolean {
  if (href === "/users") return location === "/users" || location.startsWith("/agents/");
  return location === href || location.startsWith(href + "/");
}

export function ManagerLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 flex-col bg-card border-r fixed h-screen flex shrink-0">
        <div className="p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{user?.name}</div>
              <div className="text-sm text-muted-foreground">Manager</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(href, location);
            return (
              <Link key={href} href={href}>
                <Button
                  variant={active ? "default" : "ghost"}
                  className="w-full justify-start gap-3"
                  size="lg"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={logout}
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 ml-64">
        <div className="max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
