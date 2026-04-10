import { useState } from "react";
import { useGenerateEmail, getListContentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GeneratorForm, type GeneratorFormValues } from "@/components/generator-form";
import { ContentOutput, EmptyOutputState } from "@/components/content-output";
import { Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Output = { id: string; type: string; brandId: string; variations: { id: string; content: string; platform?: string; tone?: string }[] };

export default function GenerateEmail() {
  const [output, setOutput] = useState<Output | null>(null);
  const [lastData, setLastData] = useState<GeneratorFormValues | null>(null);
  const generate = useGenerateEmail();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function onGenerate(data: GeneratorFormValues) {
    setLastData(data);
    generate.mutate({ data }, {
      onSuccess: (res) => {
        setOutput(res);
        queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
      },
      onError: () => toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" }),
    });
  }

  function onRegenerate() {
    if (lastData) onGenerate(lastData);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5" data-testid="generate-email-page">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Mail className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Email Campaign Generator</h1>
          <p className="text-muted-foreground text-sm">Campaigns that get opened, read, and clicked.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wide text-muted-foreground">Configure</h2>
          <GeneratorForm type="email" onGenerate={onGenerate} isPending={generate.isPending} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 min-h-[500px]">
          <h2 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wide text-muted-foreground">Output</h2>
          {output ? (
            <ContentOutput variations={output.variations} type="email" onRegenerate={onRegenerate} isRegenerating={generate.isPending} />
          ) : (
            <EmptyOutputState type="email" />
          )}
        </div>
      </div>
    </div>
  );
}
