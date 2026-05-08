import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AgentLayout } from "@/components/agent-layout";
import { ManagerLayout } from "@/components/manager-layout";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import AgentDashboard from "@/pages/agent-dashboard";
import AddVisit from "@/pages/add-visit";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import Users from "@/pages/users";
import AgentDetail from "@/pages/agent-detail";
import NewCall from "@/pages/new-call";
import Schedule from "@/pages/schedule";
import Reports from "@/pages/reports";
import CallLogsTable from "@/pages/call-logs-table";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, allowedRoles }: { component: any; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading)
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" />
      </div>
    );

  if (!user) return <Redirect to="/login" />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to={user.role === "Manager" ? "/dashboard" : "/home"} />;
  }

  const Shell = user.role === "Manager" ? ManagerLayout : AgentLayout;

  return (
    <Shell>
      <Component />
    </Shell>
  );
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Redirect to={user.role === "Manager" ? "/dashboard" : "/home"} />;
  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route path="/">
        <Redirect to="/login" />
      </Route>

      {/* Manager-only routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} allowedRoles={["Manager"]} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} allowedRoles={["Manager"]} />
      </Route>
      <Route path="/agents/:id">
        <ProtectedRoute component={AgentDetail} allowedRoles={["Manager"]} />
      </Route>
      <Route path="/call-logs">
        <ProtectedRoute component={CallLogsTable} allowedRoles={["Manager"]} />
      </Route>

      {/* Shared routes */}
      <Route path="/home">
        <ProtectedRoute component={AgentDashboard} allowedRoles={["Sales"]} />
      </Route>
      <Route path="/add-visit">
        <ProtectedRoute component={AddVisit} allowedRoles={["Sales"]} />
      </Route>
      <Route path="/calls/new">
        <ProtectedRoute component={NewCall} />
      </Route>
      <Route path="/schedule">
        <ProtectedRoute component={Schedule} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/customers">
        <ProtectedRoute component={Customers} />
      </Route>
      <Route path="/customers/:id">
        <ProtectedRoute component={CustomerDetail} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
