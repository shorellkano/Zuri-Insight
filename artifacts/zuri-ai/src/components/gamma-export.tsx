import { useState, useEffect } from "react";
import { Loader2, ExternalLink, Presentation, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

const API = (p: string) => `/api${p}`;

interface GammaExportProps {
  inputText: string;
  title?: string;
  defaultFormat?: "presentation" | "document";
  defaultSlides?: number;
  tone?: string;
  className?: string;
  buttonLabel?: string;
}

type Status = "idle" | "starting" | "polling" | "done" | "error";

export function GammaExport({
  inputText,
  title = "Export to Gamma",
  defaultFormat = "presentation",
  defaultSlides = 8,
  tone,
  className,
  buttonLabel = "Create Presentation",
}: GammaExportProps) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [format, setFormat] = useState<"presentation" | "document">(defaultFormat);
  const [slides, setSlides] = useState(defaultSlides);

  useEffect(() => {
    fetch(API("/gamma/status"))
      .then(r => r.json())
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (!generationId || status !== "polling") return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(API(`/gamma/poll/${generationId}`));
        const data = await r.json();
        if (data.status === "completed") {
          setGammaUrl(data.gammaUrl);
          setStatus("done");
          clearInterval(interval);
        } else if (data.status === "failed") {
          setErrorMsg("Gamma generation failed. Please try again.");
          setStatus("error");
          clearInterval(interval);
        }
      } catch {
        setErrorMsg("Lost connection while generating. Please try again.");
        setStatus("error");
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [generationId, status]);

  async function handleGenerate() {
    setStatus("starting");
    setErrorMsg("");
    setGammaUrl(null);
    try {
      const r = await fetch(API("/gamma/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText,
          format,
          numCards: slides,
          textMode: "condense",
          tone: tone ?? "professional, clear, engaging",
          textDensity: "medium",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to start generation");
      setGenerationId(data.generationId);
      setStatus("polling");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Could not start Gamma generation");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setGenerationId(null);
    setGammaUrl(null);
    setErrorMsg("");
  }

  if (configured === false) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground flex items-center gap-2", className)}>
        <Presentation className="h-4 w-4 shrink-0" />
        <span>Gamma not connected. Add your <code className="bg-muted px-1 rounded">GAMMA_API_KEY</code> to enable Gamma presentations.</span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {status === "idle" && (
            <>
              <p className="text-xs text-muted-foreground">
                Turn this content into a polished Gamma presentation or document — opens directly in Gamma for editing.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["presentation", "document"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={cn(
                      "py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-all capitalize",
                      format === f ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
                    )}
                  >
                    {f === "presentation" ? "📊 Presentation" : "📄 Document"}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Number of slides</label>
                <div className="flex gap-2">
                  {[5, 8, 12, 16].map(n => (
                    <button
                      key={n}
                      onClick={() => setSlides(n)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all",
                        slides === n ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Presentation className="h-4 w-4" />
                {buttonLabel}
              </button>
            </>
          )}

          {(status === "starting" || status === "polling") && (
            <div className="text-center py-4 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {status === "starting" ? "Sending to Gamma..." : "Gamma is building your deck..."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">This usually takes 20-40 seconds.</p>
              </div>
            </div>
          )}

          {status === "done" && gammaUrl && (
            <div className="text-center py-3 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Your Gamma deck is ready!</p>
                <p className="text-xs text-muted-foreground mt-1">Click to open and edit in Gamma.</p>
              </div>
              <a
                href={gammaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Gamma
              </a>
              <div>
                <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground underline">Generate another</button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <p className="text-sm text-destructive text-center">{errorMsg}</p>
              <button onClick={reset} className="w-full py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors">
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
