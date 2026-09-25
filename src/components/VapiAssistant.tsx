import { useEffect, useState, useRef } from "react";
import Vapi from "@vapi-ai/web";
import { Mic, MicOff, Loader2 } from "lucide-react";

export function VapiAssistant() {
  const [callStatus, setCallStatus] = useState<"inactive" | "loading" | "active">("inactive");
  
  // Initialize Vapi instance only once
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      console.warn("VITE_VAPI_PUBLIC_KEY is not defined in .env");
      return;
    }

    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    vapi.on("call-start", () => setCallStatus("active"));
    vapi.on("call-end", () => setCallStatus("inactive"));
    vapi.on("error", (e) => {
      console.error("Vapi Error:", e);
      setCallStatus("inactive");
    });

    return () => {
      vapi.removeAllListeners();
      vapi.stop();
    };
  }, []);

  const toggleCall = () => {
    const vapi = vapiRef.current;
    if (!vapi) {
      alert("Vapi is not initialized. Please check your VITE_VAPI_PUBLIC_KEY.");
      return;
    }

    if (callStatus === "active") {
      vapi.stop();
    } else {
      const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;
      if (!assistantId) {
        alert("Please set VITE_VAPI_ASSISTANT_ID in your .env file!");
        return;
      }
      setCallStatus("loading");
      vapi.start(assistantId);
    }
  };

  return (
    <button
      onClick={toggleCall}
      disabled={callStatus === "loading"}
      title="Talk to AI Assistant"
      className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl transition-all z-50 flex items-center gap-2 
        ${callStatus === "active" ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
    >
      {callStatus === "loading" && <Loader2 className="w-6 h-6 animate-spin" />}
      {callStatus === "inactive" && <Mic className="w-6 h-6" />}
      {callStatus === "active" && <MicOff className="w-6 h-6" />}
      <span className="sr-only">Toggle AI Voice Assistant</span>
    </button>
  );
}
