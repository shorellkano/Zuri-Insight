import { useListBrands } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

const schema = z.object({
  brandId: z.string().min(1, "Select a brand"),
  prompt: z.string().min(5, "Describe what to generate"),
  platform: z.string().optional(),
  tone: z.string().optional(),
  variations: z.coerce.number().min(1).max(3).optional(),
});

export type GeneratorFormValues = z.infer<typeof schema>;

interface GeneratorFormProps {
  onSubmit: (data: GeneratorFormValues) => void;
  isPending: boolean;
  platformOptions?: string[];
  toneOptions?: string[];
  defaultBrandId?: string;
}

export function GeneratorForm({ onSubmit, isPending, platformOptions, toneOptions, defaultBrandId }: GeneratorFormProps) {
  const { data: brands } = useListBrands();

  const form = useForm<GeneratorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { brandId: defaultBrandId ?? "", prompt: "", platform: "", tone: "", variations: 3 },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" data-testid="generator-form">
        <FormField control={form.control} name="brandId" render={({ field }) => (
          <FormItem>
            <FormLabel>Brand</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-brand">
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {brands?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="prompt" render={({ field }) => (
          <FormItem>
            <FormLabel>What to generate</FormLabel>
            <FormControl>
              <Textarea placeholder="e.g. Promote our new summer collection targeting young professionals in Lagos..." className="resize-none" rows={4} data-testid="input-prompt" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {platformOptions && (
          <FormField control={form.control} name="platform" render={({ field }) => (
            <FormItem>
              <FormLabel>Platform</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger data-testid="select-platform">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {platformOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}

        {toneOptions && (
          <FormField control={form.control} name="tone" render={({ field }) => (
            <FormItem>
              <FormLabel>Tone</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger data-testid="select-tone">
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {toneOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <FormField control={form.control} name="variations" render={({ field }) => (
          <FormItem>
            <FormLabel>Variations (1-3)</FormLabel>
            <FormControl>
              <Input type="number" min={1} max={3} data-testid="input-variations" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <button type="submit" disabled={isPending} data-testid="btn-generate" className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isPending ? "Generating..." : "Generate Content"}
        </button>
      </form>
    </Form>
  );
}
