import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { ErrorBoundary } from "@/components/error-boundary";
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
import BrandDna from "@/pages/brand-dna";
import GenerateHub from "@/pages/generate-hub";
import GenerateAdCopy from "@/pages/generate-ad-copy";
import GenerateSocialPosts from "@/pages/generate-social-posts";
import GenerateEmail from "@/pages/generate-email";
import GenerateWhatsapp from "@/pages/generate-whatsapp";
import GenerateVideoScripts from "@/pages/generate-video-scripts";
import ContentLibrary from "@/pages/content-library";
import Settings from "@/pages/settings";
import SettingsBilling from "@/pages/settings-billing";
import Pricing from "@/pages/pricing";
import BrandVoice from "@/pages/brand-voice";
import BrandLessons from "@/pages/brand-lessons";
import CreativeStudio from "@/pages/creative-studio";
import CreativeStudioCarousel from "@/pages/creative-studio-carousel";
import CreativeStudioQuoteCard from "@/pages/creative-studio-quote-card";
import CreativeStudioUgcVideo from "@/pages/creative-studio-ugc-video";
import CreativeStudioAnnouncement from "@/pages/creative-studio-announcement";
import CreativeStudioProductShowcase from "@/pages/creative-studio-product-showcase";
import CreativeStudioStoryCover from "@/pages/creative-studio-story-cover";
import CreativeStudioBirthdayPost from "@/pages/creative-studio-birthday-post";
import CreativeStudioTestimonial from "@/pages/creative-studio-testimonial";
import ContentCalendar from "@/pages/content-calendar";
import BulkPlan from "@/pages/bulk-plan";
import BrandCalendarPage from "@/pages/brand-calendar-page";
import BrandSettings from "@/pages/brand-settings";
import QuickCreate from "@/pages/quick-create";
import { PostPage } from "@/pages/post";
import SevenDayStarter from "@/pages/seven-day-starter";
import Features from "@/pages/features";
import Africa from "@/pages/africa";
import Blog from "@/pages/blog";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Contact from "@/pages/contact";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
    mutations: { retry: 2 },
  },
});

// Warm up the production server as early as possible.
// POST is used instead of GET because GET responses may be cached by
// Replit's reverse proxy, meaning the server never actually receives them.
// POST requests bypass all caching layers and reach the server directly.
fetch("/api/ping", { method: "POST" }).catch(() => {});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </Layout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard"><Wrap><Dashboard /></Wrap></Route>
      <Route path="/brands"><Wrap><Brands /></Wrap></Route>
      <Route path="/brands/new"><Wrap><BrandsNew /></Wrap></Route>
      <Route path="/brands/:brandId/voice"><Wrap><BrandVoice /></Wrap></Route>
      <Route path="/brands/:brandId/lessons"><Wrap><BrandLessons /></Wrap></Route>
      <Route path="/brands/:brandId/dna"><Wrap><BrandDna /></Wrap></Route>
      <Route path="/brands/:brandId/brand-calendar"><Wrap><BrandCalendarPage /></Wrap></Route>
      <Route path="/brands/:brandId/settings"><Wrap><BrandSettings /></Wrap></Route>
      <Route path="/brands/:brandId"><Wrap><BrandDetail /></Wrap></Route>
      <Route path="/generate/creative-studio/carousel"><Wrap><CreativeStudioCarousel /></Wrap></Route>
      <Route path="/generate/creative-studio/quote-card"><Wrap><CreativeStudioQuoteCard /></Wrap></Route>
      <Route path="/generate/creative-studio/ugc-video"><Wrap><CreativeStudioUgcVideo /></Wrap></Route>
      <Route path="/generate/creative-studio/announcement"><Wrap><CreativeStudioAnnouncement /></Wrap></Route>
      <Route path="/generate/creative-studio/product-showcase"><Wrap><CreativeStudioProductShowcase /></Wrap></Route>
      <Route path="/generate/creative-studio/story-cover"><Wrap><CreativeStudioStoryCover /></Wrap></Route>
      <Route path="/generate/creative-studio/birthday-post"><Wrap><CreativeStudioBirthdayPost /></Wrap></Route>
      <Route path="/generate/creative-studio/testimonial"><Wrap><CreativeStudioTestimonial /></Wrap></Route>
      <Route path="/generate/creative-studio"><Wrap><CreativeStudio /></Wrap></Route>
      <Route path="/generate/bulk-plan"><Wrap><BulkPlan /></Wrap></Route>
      <Route path="/generate"><Wrap><GenerateHub /></Wrap></Route>
      <Route path="/generate/ad-copy"><Wrap><GenerateAdCopy /></Wrap></Route>
      <Route path="/generate/social-posts"><Wrap><GenerateSocialPosts /></Wrap></Route>
      <Route path="/generate/email"><Wrap><GenerateEmail /></Wrap></Route>
      <Route path="/generate/whatsapp"><Wrap><GenerateWhatsapp /></Wrap></Route>
      <Route path="/generate/video-scripts"><Wrap><GenerateVideoScripts /></Wrap></Route>
      <Route path="/quick-create"><Wrap><QuickCreate /></Wrap></Route>
      <Route path="/7-day-starter"><Wrap><SevenDayStarter /></Wrap></Route>
      <Route path="/post"><Wrap><PostPage /></Wrap></Route>
      <Route path="/calendar"><Wrap><ContentCalendar /></Wrap></Route>
      <Route path="/content"><Wrap><ContentLibrary /></Wrap></Route>
      <Route path="/settings/billing"><Wrap><SettingsBilling /></Wrap></Route>
      <Route path="/settings"><Wrap><Settings /></Wrap></Route>
      <Route path="/pricing" component={Pricing} />
      <Route path="/features" component={Features} />
      <Route path="/africa" component={Africa} />
      <Route path="/blog" component={Blog} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
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
