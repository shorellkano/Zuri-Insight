import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateBrand, useBuildBrandDna, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

const step1Schema = z.object({
  name: z.string().min(1, "Brand name is required"),
  websiteUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  industry: z.string().optional(),
  targetMarket: z.string().optional(),
});

const step2Schema = z.object({
  instagramHandle: z.string().optional(),
  twitterHandle: z.string().optional(),
  linkedinUrl: z.string().optional(),
  tiktokHandle: z.string().optional(),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;

const STEPS = ["Brand Info", "Social Handles", "Build DNA"];

export default function BrandsNew() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [dnaBuilt, setDnaBuilt] = useState(false);
  const queryClient = useQueryClient();

  const createBrand = useCreateBrand();
  const buildDna = useBuildBrandDna();

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema), defaultValues: { name: "", websiteUrl: "", industry: "", targetMarket: "" } });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema), defaultValues: { instagramHandle: "", twitterHandle: "", linkedinUrl: "", tiktokHandle: "" } });

  async function onStep1(data: Step1) {
    createBrand.mutate({ data }, {
      onSuccess: (brand) => {
        setBrandId(brand.id);
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
        setStep(1);
      }
    });
  }

  async function onStep2(data: Step2) {
    setStep(2);
  }

  async function onBuildDna() {
    if (!brandId) return;
    buildDna.mutate({ brandId }, {
      onSuccess: () => {
        setDnaBuilt(true);
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
      }
    });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8" data-testid="brands-new-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Brand</h1>
        <p className="text-muted-foreground mt-1">Set up your brand profile and build its DNA intelligence.</p>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className="text-sm font-medium hidden sm:block">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-8">
        {step === 0 && (
          <Form {...form1}>
            <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-5" data-testid="brand-info-form">
              <h2 className="text-lg font-semibold text-foreground mb-5">Brand Information</h2>
              <FormField control={form1.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Kente Market" data-testid="input-brand-name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form1.control} name="websiteUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Website URL</FormLabel>
                  <FormControl><Input placeholder="https://yourbrand.com" data-testid="input-website-url" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form1.control} name="industry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl><Input placeholder="e.g. Fashion, Technology, Food & Beverage" data-testid="input-industry" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form1.control} name="targetMarket" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Market</FormLabel>
                  <FormControl><Input placeholder="e.g. West Africa — Nigeria, Ghana, Senegal" data-testid="input-target-market" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <button type="submit" disabled={createBrand.isPending} data-testid="btn-next-step1" className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {createBrand.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </form>
          </Form>
        )}

        {step === 1 && (
          <Form {...form2}>
            <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-5" data-testid="social-handles-form">
              <h2 className="text-lg font-semibold text-foreground mb-5">Social Media Handles</h2>
              <p className="text-sm text-muted-foreground">Optional: Add your social handles to help Zuri AI build a richer Brand DNA profile.</p>
              {[
                { name: "instagramHandle" as const, label: "Instagram Handle", placeholder: "@yourbrand" },
                { name: "twitterHandle" as const, label: "Twitter/X Handle", placeholder: "@yourbrand" },
                { name: "linkedinUrl" as const, label: "LinkedIn URL", placeholder: "https://linkedin.com/company/yourbrand" },
                { name: "tiktokHandle" as const, label: "TikTok Handle", placeholder: "@yourbrand" },
              ].map(({ name, label, placeholder }) => (
                <FormField key={name} control={form2.control} name={name} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input placeholder={placeholder} data-testid={`input-${name}`} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(0)} data-testid="btn-back-step2" className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button type="submit" data-testid="btn-next-step2" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors">
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </Form>
        )}

        {step === 2 && (
          <div className="text-center" data-testid="build-dna-step">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-3">Build Brand DNA</h2>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              Zuri AI will analyze your brand information and build an intelligent DNA profile — your brand's unique voice, values, and cultural context.
            </p>
            {!dnaBuilt ? (
              <button onClick={onBuildDna} disabled={buildDna.isPending} data-testid="btn-build-dna" className="flex items-center gap-2.5 px-7 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors mx-auto">
                {buildDna.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {buildDna.isPending ? "Building DNA..." : "Build Brand DNA"}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Brand DNA successfully built!</span>
                </div>
                <button onClick={() => brandId && setLocation(`/brands/${brandId}`)} data-testid="btn-view-brand" className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors mx-auto">
                  View Brand Profile <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
