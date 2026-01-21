import { useMemo } from "react";
import { useProjectStore } from "../stores/projectStore";

export function useAgentStatus() {
  const outputs = useProjectStore((state) => state.outputs);

  const readyCount = useMemo(
    () => outputs.filter((output) => output.status === "ready").length,
    [outputs]
  );

  return {
    outputs,
    readyCount,
    total: outputs.length
  };
}
