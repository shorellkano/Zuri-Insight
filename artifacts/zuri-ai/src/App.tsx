import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";

// Pages
import Home from "@/pages/home";
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

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard"><Layout><Dashboard /></Layout></Route>
      <Route path="/brands"><Layout><Brands /></Layout></Route>
      <Route path="/brands/new"><Layout><BrandsNew /></Layout></Route>
      <Route path="/brands/:brandId"><Layout><BrandDetail /></Layout></Route>
      <Route path="/generate"><Layout><GenerateHub /></Layout></Route>
      <Route path="/generate/ad-copy"><Layout><GenerateAdCopy /></Layout></Route>
      <Route path="/generate/social-posts"><Layout><GenerateSocialPosts /></Layout></Route>
      <Route path="/generate/email"><Layout><GenerateEmail /></Layout></Route>
      <Route path="/generate/whatsapp"><Layout><GenerateWhatsapp /></Layout></Route>
      <Route path="/generate/video-scripts"><Layout><GenerateVideoScripts /></Layout></Route>
      <Route path="/content"><Layout><ContentLibrary /></Layout></Route>
      <Route path="/settings"><Layout><Settings /></Layout></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
