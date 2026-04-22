import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import AddVisit from "@/pages/add-visit";
import Followups from "@/pages/followups";
import OverdueFollowups from "@/pages/followups-overdue";
import Customers from "@/pages/customers";
import Users from "@/pages/users";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20"></div></div>;

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to={user.role === "Manager" ? "/dashboard" : "/add-visit"} />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Redirect to={user.role === "Manager" ? "/dashboard" : "/add-visit"} />;
  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route path="/">
        <Redirect to="/login" />
      </Route>

      {/* Manager Routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} allowedRoles={["Manager"]} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} allowedRoles={["Manager"]} />
      </Route>

      {/* Sales Routes */}
      <Route path="/add-visit">
        <ProtectedRoute component={AddVisit} allowedRoles={["Sales"]} />
      </Route>
      <Route path="/followups">
        <ProtectedRoute component={Followups} allowedRoles={["Sales"]} />
      </Route>
      <Route path="/followups/overdue">
        <ProtectedRoute component={OverdueFollowups} allowedRoles={["Sales"]} />
      </Route>
      <Route path="/customers">
        <ProtectedRoute component={Customers} allowedRoles={["Sales"]} />
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
