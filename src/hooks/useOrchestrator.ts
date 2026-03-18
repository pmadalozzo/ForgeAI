/**
 * Hook useOrchestrator — Inicializa e expoe o OrchestratorService no React.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { orchestratorService } from "../services/agents/orchestrator-service";

interface UseOrchestratorReturn {
  /** Envia uma mensagem para o orchestrator processar */
  processMessage: (message: string, projectId: string) => Promise<void>;
  /** Se o orchestrator esta processando uma mensagem */
  isProcessing: boolean;
  /** Se o orchestrator esta pronto para receber mensagens */
  orchestratorReady: boolean;
}

/**
 * Inicializa o OrchestratorService e expoe metodos para o componente.
 */
export function useOrchestrator(): UseOrchestratorReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [orchestratorReady, setOrchestratorReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      orchestratorService.initialize();
      setOrchestratorReady(true);
    } catch (error) {
      console.error("[useOrchestrator] Falha ao inicializar:", error);
      setOrchestratorReady(false);
    }

    return () => {
      orchestratorService.shutdown();
      initializedRef.current = false;
    };
  }, []);

  const processMessage = useCallback(async (message: string, projectId: string) => {
    setIsProcessing(true);
    try {
      await orchestratorService.processUserMessage(message, projectId);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    processMessage,
    isProcessing,
    orchestratorReady,
  };
}
