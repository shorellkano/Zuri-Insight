import { useState } from "react";
import { useGenerateEmail, getListContentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GeneratorForm, type GeneratorFormValues } from "@/components/generator-form";
import { ContentOutput } from "@/components/content-output";
import { Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TONES = ["Professional", "Warm & Personal", "Urgent", "Celebratory", "Informational", "Sales-driven"];

export default function GenerateEmail() {
  const [output, setOutput] = useState<{ id: string; type: string; brandId: string; variations: { id: string; content: string; platform?: string; tone?: string }[] } | null>(null);
  const generate = useGenerateEmail();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function onSubmit(data: GeneratorFormValues) {
    generate.mutate({ data }, {
      onSuccess: (res) => {
        setOutput(res);
        queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
      },
      onError: () => toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" }),
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="generate-email-page">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Mail className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Campaign Generator</h1>
          <p className="text-muted-foreground text-sm">Create full email campaigns with subject lines and compelling body copy.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-2xl p-7">
          <h2 className="font-semibold text-foreground mb-5">Configure</h2>
          <GeneratorForm onSubmit={onSubmit} isPending={generate.isPending} toneOptions={TONES} />
        </div>
        <div>
          {output ? (
            <ContentOutput variations={output.variations} type="email" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
              <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Generated emails will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
