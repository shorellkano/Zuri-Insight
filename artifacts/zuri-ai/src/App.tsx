import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";

// Pages
import Home from "@/pages/home";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Brands from "@/pages/brands";
import BrandsNew from "@/pages/brands-new";
import BrandDetail from "@/pages/brand-detail";
import GenerateHub from "@/pages/generate-hub";
import GenerateAdCopy from "@/pages/generate-ad-copy";
import GenerateSocialPosts from "@/pages/generate-social-posts";
import GenerateEmail from "@/pages/generate-email";
import GenerateWhatsapp from "@/pages/generate-whatsapp";
import GenerateVideoScripts from "@/pages/generate-video-scripts";
import ContentLibrary from "@/pages/content-library";
import Settings from "@/pages/settings";
import BrandVoice from "@/pages/brand-voice";
import BrandLessons from "@/pages/brand-lessons";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard"><ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute></Route>
      <Route path="/brands"><ProtectedRoute><Layout><Brands /></Layout></ProtectedRoute></Route>
      <Route path="/brands/new"><ProtectedRoute><Layout><BrandsNew /></Layout></ProtectedRoute></Route>
      <Route path="/brands/:brandId/voice"><ProtectedRoute><Layout><BrandVoice /></Layout></ProtectedRoute></Route>
      <Route path="/brands/:brandId/lessons"><ProtectedRoute><Layout><BrandLessons /></Layout></ProtectedRoute></Route>
      <Route path="/brands/:brandId"><ProtectedRoute><Layout><BrandDetail /></Layout></ProtectedRoute></Route>
      <Route path="/generate"><ProtectedRoute><Layout><GenerateHub /></Layout></ProtectedRoute></Route>
      <Route path="/generate/ad-copy"><ProtectedRoute><Layout><GenerateAdCopy /></Layout></ProtectedRoute></Route>
      <Route path="/generate/social-posts"><ProtectedRoute><Layout><GenerateSocialPosts /></Layout></ProtectedRoute></Route>
      <Route path="/generate/email"><ProtectedRoute><Layout><GenerateEmail /></Layout></ProtectedRoute></Route>
      <Route path="/generate/whatsapp"><ProtectedRoute><Layout><GenerateWhatsapp /></Layout></ProtectedRoute></Route>
      <Route path="/generate/video-scripts"><ProtectedRoute><Layout><GenerateVideoScripts /></Layout></ProtectedRoute></Route>
      <Route path="/content"><ProtectedRoute><Layout><ContentLibrary /></Layout></ProtectedRoute></Route>
      <Route path="/settings"><ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
