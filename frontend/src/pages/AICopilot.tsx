import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  KeyboardEvent,
} from "react";

import {
  ArrowDown,
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  Factory,
  Plus,
  Send,
  Sparkles,
  Activity,
} from "lucide-react";

import {
  getMachines,
  sendCopilotMessage,
} from "../services/api";

import type {
  Machine,
} from "../services/api";

import {
  useMachineSelection,
} from "../context/MachineSelectionContext";

/* ============================================================
   TYPES
============================================================ */

type ChatRole =
  | "user"
  | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type RiskLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNKNOWN";

type ContextOption = {
  id: string;
  label: string;
  subtitle: string;
  isFactory?: boolean;
  machine?: Machine;
};

type CopilotResponse = {
  success: boolean;
  model?: string;
  message?: string;
  answer?: string;
  scope?: string;
  machine_id?: string | null;
};

/* ============================================================
   CONSTANTS
============================================================ */

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hello. I'm CarbonTwin Copilot.\n\nI can analyze your live factory state, predictive failure risk, machine health, degradation, remaining useful life, maintenance priorities and sustainability data.\n\nSelect a machine or use Entire Factory, then ask me what you want to investigate.",
};

/* ============================================================
   RISK HELPERS
============================================================ */

function getRiskLevel(
  machine?: Machine,
): RiskLevel {
  const level =
    machine?.ai_prediction?.risk_level;

  switch (level) {
    case "CRITICAL":
    case "HIGH":
    case "MEDIUM":
    case "LOW":
      return level;

    default:
      return "UNKNOWN";
  }
}


function getRiskScore(
  machine?: Machine,
): number | null {
  if (!machine) {
    return null;
  }

  const prediction =
    machine.ai_prediction;

  const score =
    prediction?.risk_score;

  if (
    typeof score === "number" &&
    Number.isFinite(score)
  ) {
    return score;
  }

  if (
    typeof machine.failure_probability ===
      "number" &&
    Number.isFinite(
      machine.failure_probability,
    )
  ) {
    return (
      machine.failure_probability / 100
    );
  }

  return null;
}


function getRiskClasses(
  level: RiskLevel,
) {
  switch (level) {
    case "CRITICAL":
      return {
        text: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        dot: "bg-red-500",
      };

    case "HIGH":
      return {
        text: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        dot: "bg-orange-500",
      };

    case "MEDIUM":
      return {
        text: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        dot: "bg-amber-500",
      };

    case "LOW":
      return {
        text: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        dot: "bg-emerald-500",
      };

    default:
      return {
        text: "text-slate-500",
        bg: "bg-slate-50",
        border: "border-slate-200",
        dot: "bg-slate-400",
      };
  }
}

/* ============================================================
   INLINE MARKDOWN
============================================================ */

function renderInline(
  text: string,
) {
  const parts =
    text.split(
      /(\*\*.*?\*\*|`.*?`)/g,
    );

  return parts.map(
    (
      part,
      index,
    ) => {
      if (
        part.startsWith("**") &&
        part.endsWith("**")
      ) {
        return (
          <strong
            key={index}
            className="font-semibold text-slate-900"
          >
            {part.slice(
              2,
              -2,
            )}
          </strong>
        );
      }

      if (
        part.startsWith("`") &&
        part.endsWith("`")
      ) {
        return (
          <code
            key={index}
            className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-emerald-700"
          >
            {part.slice(
              1,
              -1,
            )}
          </code>
        );
      }

      return (
        <span key={index}>
          {part}
        </span>
      );
    },
  );
}

/* ============================================================
   MARKDOWN TABLE DETECTION
============================================================ */

function isTableSeparator(
  line: string,
) {
  const cells =
    line
      .split("|")
      .map(
        (cell) =>
          cell.trim(),
      )
      .filter(Boolean);

  return (
    cells.length > 0 &&
    cells.every(
      (cell) =>
        /^:?-{2,}:?$/.test(
          cell,
        ),
    )
  );
}


function parseTable(
  lines: string[],
  startIndex: number,
) {
  if (
    startIndex + 1 >=
    lines.length
  ) {
    return null;
  }

  const header =
    lines[startIndex];

  const separator =
    lines[startIndex + 1];

  if (
    !header.includes("|") ||
    !isTableSeparator(
      separator,
    )
  ) {
    return null;
  }

  const parseRow =
    (line: string) =>
      line
        .split("|")
        .map(
          (cell) =>
            cell.trim(),
        )
        .filter(
          (cell, index, array) =>
            !(
              index === 0 &&
              cell === ""
            ) &&
            !(
              index ===
                array.length - 1 &&
              cell === ""
            ),
        );

  const headers =
    parseRow(header);

  const rows: string[][] = [];

  let index =
    startIndex + 2;

  while (
    index < lines.length
  ) {
    const line =
      lines[index].trim();

    if (
      !line.includes("|") ||
      !line
    ) {
      break;
    }

    rows.push(
      parseRow(line),
    );

    index++;
  }

  return {
    headers,
    rows,
    endIndex: index,
  };
}

/* ============================================================
   ASSISTANT MARKDOWN RENDERER
============================================================ */

function AssistantContent({
  content,
}: {
  content: string;
}) {
  const lines =
    content.split("\n");

  const output: React.ReactElement[] = [];
  let index = 0;

  while (
    index < lines.length
  ) {
    const raw =
      lines[index];

    const line =
      raw.trim();

    if (!line) {
      output.push(
        <div
          key={`space-${index}`}
          className="h-2"
        />,
      );

      index++;
      continue;
    }

    /* --------------------------------------------------------
       TABLE
    -------------------------------------------------------- */

    const table =
      parseTable(
        lines,
        index,
      );

    if (table) {
      output.push(
        <div
          key={`table-${index}`}
          className="my-4 overflow-x-auto rounded-xl border border-slate-200 bg-white"
        >
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {table.headers.map(
                  (
                    header,
                    headerIndex,
                  ) => (
                    <th
                      key={headerIndex}
                      className="px-4 py-3 text-left text-xs font-bold text-slate-700"
                    >
                      {renderInline(
                        header,
                      )}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {table.rows.map(
                (
                  row,
                  rowIndex,
                ) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-slate-100 last:border-0"
                  >
                    {table.headers.map(
                      (
                        _,
                        cellIndex,
                      ) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-3 align-top text-sm text-slate-600"
                        >
                          {renderInline(
                            row[cellIndex] ??
                              "",
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>,
      );

      index =
        table.endIndex;

      continue;
    }

    /* --------------------------------------------------------
       H1
    -------------------------------------------------------- */

    if (
      line.startsWith("# ")
    ) {
      output.push(
        <h2
          key={index}
          className="mb-3 mt-5 text-xl font-bold tracking-tight text-slate-900"
        >
          {renderInline(
            line.slice(2),
          )}
        </h2>,
      );

      index++;
      continue;
    }

    /* --------------------------------------------------------
       H2
    -------------------------------------------------------- */

    if (
      line.startsWith("## ")
    ) {
      output.push(
        <h3
          key={index}
          className="mb-2 mt-5 text-lg font-bold text-slate-900"
        >
          {renderInline(
            line.slice(3),
          )}
        </h3>,
      );

      index++;
      continue;
    }

    /* --------------------------------------------------------
       H3
    -------------------------------------------------------- */

    if (
      line.startsWith("### ")
    ) {
      output.push(
        <h4
          key={index}
          className="mb-2 mt-5 flex items-center gap-2 text-sm font-bold text-slate-900"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

          {renderInline(
            line.slice(4),
          )}
        </h4>,
      );

      index++;
      continue;
    }

    /* --------------------------------------------------------
       BULLET
    -------------------------------------------------------- */

    if (
      line.startsWith("* ") ||
      line.startsWith("- ")
    ) {
      output.push(
        <div
          key={index}
          className="my-1 flex gap-2 pl-1"
        >
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />

          <p className="min-w-0 text-[15px] leading-7 text-slate-600">
            {renderInline(
              line.slice(2),
            )}
          </p>
        </div>,
      );

      index++;
      continue;
    }

    /* --------------------------------------------------------
       NUMBERED LIST
    -------------------------------------------------------- */

    const numbered =
      line.match(
        /^(\d+)\.\s+(.*)$/,
      );

    if (numbered) {
      output.push(
        <div
          key={index}
          className="my-1 flex gap-3 pl-1"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">
            {numbered[1]}
          </span>

          <p className="min-w-0 text-[15px] leading-7 text-slate-600">
            {renderInline(
              numbered[2],
            )}
          </p>
        </div>,
      );

      index++;
      continue;
    }

    /* --------------------------------------------------------
       BLOCKQUOTE
    -------------------------------------------------------- */

    if (
      line.startsWith("> ")
    ) {
      output.push(
        <div
          key={index}
          className="my-3 border-l-2 border-emerald-400 pl-4 text-sm italic leading-6 text-slate-500"
        >
          {renderInline(
            line.slice(2),
          )}
        </div>,
      );

      index++;
      continue;
    }

    /* --------------------------------------------------------
       NORMAL PARAGRAPH
    -------------------------------------------------------- */

    output.push(
      <p
        key={index}
        className="my-2 text-[15px] leading-7 text-slate-600"
      >
        {renderInline(line)}
      </p>,
    );

    index++;
  }

  return (
    <div>
      {output}
    </div>
  );
}

/* ============================================================
   COMPONENT
============================================================ */

export default function AICopilot() {
  const [
    machines,
    setMachines,
  ] = useState<Machine[]>([]);

  /* ==========================================================
     SHARED MACHINE CONTEXT
  ========================================================== */

  const {
    scope,
    selectedMachineId,
    selectMachine,
    selectFactory,
  } = useMachineSelection();

  /*
   * Copilot uses "factory" internally for its factory-wide
   * context, while the shared application context represents
   * factory scope with a null machine id.
   */
  const selectedMachine =
    scope === "factory"
      ? "factory"
      : selectedMachineId ?? "factory";

  const [
    question,
    setQuestion,
  ] = useState("");

  const [
    messages,
    setMessages,
  ] = useState<ChatMessage[]>([
    INITIAL_MESSAGE,
  ]);

  const [
    loadingMachines,
    setLoadingMachines,
  ] = useState(true);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    copiedMessage,
    setCopiedMessage,
  ] = useState<
    number | null
  >(null);

  const [
    contextOpen,
    setContextOpen,
  ] = useState(false);

  const [
    showScrollButton,
    setShowScrollButton,
  ] = useState(false);

  const messagesContainerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null,
    );

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  /* ==========================================================
     LOAD MACHINES
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadMachines() {
      try {
        const data =
          await getMachines();

        if (!mounted) {
          return;
        }

        setMachines(data);

      } catch (requestError) {
        console.error(
          "Failed to load machines:",
          requestError,
        );

        if (mounted) {
          setError(
            "Unable to load CarbonTwin machines.",
          );
        }
      } finally {
        if (mounted) {
          setLoadingMachines(
            false,
          );
        }
      }
    }

    void loadMachines();

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================
     KEEP SHARED MACHINE CONTEXT VALID
  ========================================================== */

  useEffect(() => {
    if (
      scope === "factory" ||
      !selectedMachineId ||
      machines.length === 0
    ) {
      return;
    }

    const exists = machines.some(
      (machine) =>
        machine.id === selectedMachineId,
    );

    if (!exists) {
      selectFactory();
    }
  }, [
    machines,
    scope,
    selectedMachineId,
    selectFactory,
  ]);

  /* ==========================================================
     CONTEXT OPTIONS
  ========================================================== */

  const contextOptions =
    useMemo<
      ContextOption[]
    >(
      () => [
        {
          id: "factory",
          label: "Entire Factory",
          subtitle:
            "Live factory-wide context",
          isFactory: true,
        },

        ...machines.map(
          (machine) => ({
            id: machine.id,
            label:
              machine.name,
            subtitle:
              `${machine.type} · ${machine.id}`,
            machine,
          }),
        ),
      ],
      [machines],
    );

  /* ==========================================================
     ACTIVE CONTEXT
  ========================================================== */

  const activeContext =
    useMemo(
      () =>
        contextOptions.find(
          (option) =>
            option.id ===
            selectedMachine,
        ) ??
        contextOptions[0],
      [
        contextOptions,
        selectedMachine,
      ],
    );

  const selectedMachineData =
    activeContext?.machine;

  /* ==========================================================
     SELECTED MACHINE RISK
  ========================================================== */

  const selectedRisk =
    getRiskLevel(
      selectedMachineData,
    );

  const selectedRiskScore =
    getRiskScore(
      selectedMachineData,
    );

  const selectedRiskClasses =
    getRiskClasses(
      selectedRisk,
    );

  /* ==========================================================
     SCROLL HANDLING
  ========================================================== */

  function scrollToLatest(
    behavior: ScrollBehavior = "smooth",
  ) {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior,
        block: "end",
      },
    );
  }

  function handleMessagesScroll() {
    const container =
      messagesContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    setShowScrollButton(
      distanceFromBottom > 180,
    );
  }

  useEffect(() => {
    if (sending) {
      return;
    }

    requestAnimationFrame(() => {
      scrollToLatest(
        "smooth",
      );
    });
  }, [messages, sending]);

  /* ==========================================================
     INPUT AUTO RESIZE
  ========================================================== */

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height =
      "auto";

    textarea.style.height =
      `${Math.min(
        textarea.scrollHeight,
        150,
      )}px`;
  }, [question]);

  /* ==========================================================
     SUGGESTIONS
  ========================================================== */

  const suggestions =
    useMemo(
      () => [
        {
          label:
            "Highest predictive risk",

          prompt:
            "Which machine currently has the highest predictive risk? Give me its exact 30 minute, 60 minute and 120 minute failure probabilities, RUL, risk level and recommended action. Use only current CarbonTwin data and do not estimate values.",
        },

        {
          label:
            "Explain selected machine",

          prompt:
            selectedMachineData
              ? `Explain why ${selectedMachineData.id} is currently in its present condition. Include its predictive risk, telemetry, degradation evidence, RUL and recommended action. Use only current CarbonTwin data.`
              : "Explain the current factory condition using only current CarbonTwin data.",
        },

        {
          label:
            "Maintenance priority",

          prompt:
            "Which machine should maintenance prioritize first and why? Use the current predictive risk, RUL, degradation condition and recommended action.",
        },

        {
          label:
            "Risk horizons",

          prompt:
            selectedMachineData
              ? `Give me the exact 30 minute, 60 minute and 120 minute predictive failure probabilities for ${selectedMachineData.id}. Do not estimate unavailable values.`
              : "Give me the exact predictive failure probabilities for the highest-risk machine at 30, 60 and 120 minutes.",
        },

        {
          label:
            "Telemetry drivers",

          prompt:
            selectedMachineData
              ? `What current telemetry signals are relevant to ${selectedMachineData.id}'s condition? Explain using only the available CarbonTwin evidence.`
              : "Which telemetry signals are currently driving machine risk in the factory?",
        },

        {
          label:
            "Factory overview",

          prompt:
            "Give me a concise operational overview of the factory's current AI condition, including critical assets, high-risk assets, predictive coverage and the most important maintenance action.",
        },
      ],
      [
        selectedMachineData,
      ],
    );

  /* ==========================================================
     SEND TO COPILOT
  ========================================================== */

  async function askCopilot(
    customQuestion?: string,
  ) {
    const message =
      (
        customQuestion ??
        question
      ).trim();

    if (
      !message ||
      sending
    ) {
      return;
    }

    if (
      !machines.length
    ) {
      setError(
        "No machine data is currently available.",
      );

      return;
    }

    setError(null);

    const historyForRequest =
      messages.map(
        (item) => ({
          role: item.role,
          content: item.content,
        }),
      );

    const userMessage:
      ChatMessage = {
      role: "user",
      content: message,
    };

    setMessages(
      (previous) => [
        ...previous,
        userMessage,
      ],
    );

    setQuestion("");

    setSending(true);

    setContextOpen(false);

    requestAnimationFrame(() => {
      scrollToLatest(
        "smooth",
      );
    });

    try {
      const response =
        await sendCopilotMessage(
          message,
          historyForRequest,
          selectedMachine ===
            "factory"
            ? null
            : selectedMachine,
        );

      const copilotResponse =
        response as CopilotResponse;

      const answer =
        copilotResponse.answer ||
        "CarbonTwin Copilot did not return an answer.";

      setMessages(
        (previous) => [
          ...previous,
          {
            role: "assistant",
            content: answer,
          },
        ],
      );
    } catch (
      requestError
    ) {
      console.error(
        "Copilot request failed:",
        requestError,
      );

      let errorMessage =
        "CarbonTwin Copilot is temporarily unavailable.";

      if (
        requestError instanceof Error
      ) {
        const raw =
          requestError.message;

        if (
          raw.includes("503") ||
          raw.includes(
            "high demand",
          ) ||
          raw.includes(
            "UNAVAILABLE",
          )
        ) {
          errorMessage =
            "The AI model is temporarily experiencing high demand. Your CarbonTwin data is still available; please try Copilot again in a moment.";
        } else {
          errorMessage =
            raw;
        }
      }

      setError(
        errorMessage,
      );
    } finally {
      setSending(false);
    }
  }

  /* ==========================================================
     KEYBOARD
  ========================================================== */

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      void askCopilot();
    }
  }

  /* ==========================================================
     COPY MESSAGE
  ========================================================== */

  async function copyMessage(
    content: string,
    index: number,
  ) {
    try {
      await navigator.clipboard.writeText(
        content,
      );

      setCopiedMessage(
        index,
      );

      window.setTimeout(
        () => {
          setCopiedMessage(
            null,
          );
        },
        1500,
      );
    } catch {
      setCopiedMessage(
        null,
      );
    }
  }

  /* ==========================================================
     NEW CHAT
  ========================================================== */

  function clearChat() {
    setMessages([
      INITIAL_MESSAGE,
    ]);

    setQuestion("");

    setError(null);

    setCopiedMessage(
      null,
    );

    requestAnimationFrame(() => {
      scrollToLatest(
        "auto",
      );
    });
  }

  /* ==========================================================
     CONTEXT CHANGE
  ========================================================== */

  function changeContext(
    contextId: string,
  ) {
    if (contextId === "factory") {
      selectFactory();
    } else {
      selectMachine(contextId);
    }

    setContextOpen(
      false,
    );

    /*
     * We intentionally keep the conversation.
     *
     * This allows an operator to investigate one
     * machine, switch context and continue asking
     * related questions without starting over.
     */
  }

  /* ==========================================================
     LOADING
  ========================================================== */

  if (
    loadingMachines
  ) {
    return (
      <main className="flex h-full min-h-[calc(100vh-64px)] items-center justify-center bg-white text-slate-900">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
            <Bot
              size={22}
              className="animate-pulse text-emerald-600"
            />
          </div>

          <p className="mt-4 text-sm font-semibold">
            Connecting to CarbonTwin
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Loading live factory context...
          </p>
        </div>
      </main>
    );
  }

  /* ==========================================================
     MAIN
  ========================================================== */

  return (
    <main className="flex h-full min-h-[calc(100vh-64px)] min-w-0 flex-col overflow-hidden bg-white text-slate-900">
      <div className="flex min-h-0 flex-1 flex-col">

        {/* ====================================================
            TOP BAR
        ==================================================== */}

        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Bot
                size={18}
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold tracking-tight text-slate-900">
                  CarbonTwin Copilot
                </h1>

                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 sm:flex">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>

              <p className="hidden text-[11px] text-slate-400 sm:block">
                Industrial intelligence assistant
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={clearChat}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">
              New chat
            </span>
          </button>
        </header>

        {/* ====================================================
            CONTEXT BAR
        ==================================================== */}

        <div className="relative z-20 shrink-0 border-b border-slate-100 bg-white px-4 py-2.5 sm:px-6">

          <div className="flex items-center justify-between gap-3">

            <div className="flex min-w-0 items-center gap-2">

              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                {activeContext?.isFactory ? (
                  <Factory size={14} />
                ) : (
                  <Activity size={14} />
                )}
              </span>

              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  AI context
                </p>

                <p className="truncate text-xs font-semibold text-slate-800">
                  {activeContext?.label ??
                    "Entire Factory"}
                </p>
              </div>

              {selectedMachineData && (
                <span
                  className={`hidden rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider sm:inline-flex ${selectedRiskClasses.bg} ${selectedRiskClasses.border} ${selectedRiskClasses.text}`}
                >
                  <span
                    className={`mr-1.5 mt-0.5 h-1.5 w-1.5 rounded-full ${selectedRiskClasses.dot}`}
                  />

                  {selectedRisk}
                  {selectedRiskScore !== null
                    ? ` · ${(
                        selectedRiskScore *
                        100
                      ).toFixed(1)}%`
                    : ""}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setContextOpen(
                  (value) =>
                    !value,
                )
              }
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Change context
              <ChevronDown
                size={14}
                className={
                  contextOpen
                    ? "rotate-180 transition"
                    : "transition"
                }
              />
            </button>
          </div>

          {/* ==================================================
              CONTEXT MENU
          ================================================== */}

          {contextOpen && (
            <div className="absolute left-4 right-4 top-[calc(100%+6px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.14)] sm:left-auto sm:right-6 sm:w-[390px]">

              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-xs font-bold text-slate-800">
                  Choose AI context
                </p>

                <p className="mt-0.5 text-[10px] text-slate-400">
                  The selected context is sent with every Copilot request.
                </p>
              </div>

              <div className="max-h-[360px] overflow-y-auto p-2">

                {contextOptions.map(
                  (option) => {
                    const active =
                      option.id ===
                      selectedMachine;

                    const risk =
                      getRiskLevel(
                        option.machine,
                      );

                    const riskClasses =
                      getRiskClasses(
                        risk,
                      );

                    return (
                      <button
                        key={
                          option.id
                        }
                        type="button"
                        onClick={() =>
                          changeContext(
                            option.id,
                          )
                        }
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                          active
                            ? "bg-emerald-50"
                            : "hover:bg-slate-50"
                        }`}
                      >

                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            option.isFactory
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {option.isFactory ? (
                            <Factory
                              size={15}
                            />
                          ) : (
                            <Activity
                              size={15}
                            />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">

                          <span className="block truncate text-xs font-semibold text-slate-800">
                            {
                              option.label
                            }
                          </span>

                          <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                            {
                              option.subtitle
                            }
                          </span>
                        </span>

                        {option.machine &&
                          risk !==
                            "UNKNOWN" && (
                            <span
                              className={`hidden rounded-full border px-2 py-1 text-[8px] font-bold sm:inline-flex ${riskClasses.bg} ${riskClasses.border} ${riskClasses.text}`}
                            >
                              {risk}
                            </span>
                          )}

                        {active && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <Check
                              size={11}
                            />
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}
        </div>

        {/* ====================================================
            CONVERSATION
        ==================================================== */}

        <div className="relative min-h-0 flex-1">

          <div
            ref={
              messagesContainerRef
            }
            onScroll={
              handleMessagesScroll
            }
            className="absolute inset-0 overflow-y-auto overscroll-contain"
          >

            <div className="mx-auto w-full max-w-[880px] px-4 pb-44 pt-8 sm:px-6 sm:pt-10">

              {/* ==================================================
                  WELCOME STATE
              ================================================== */}

              {messages.length ===
                1 && (
                <div className="mb-8">

                  <div className="mx-auto max-w-[720px] text-center">

                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Sparkles
                        size={25}
                      />
                    </div>

                    <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      How can I help with your factory?
                    </h2>

                    <p className="mx-auto mt-3 max-w-[620px] text-sm leading-6 text-slate-500">
                      Ask about predictive failure risk,
                      machine condition, RUL,
                      maintenance priorities,
                      telemetry or factory-wide operations.
                    </p>

                    <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-semibold text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Current context:
                      <span className="text-slate-600">
                        {
                          activeContext?.label
                        }
                      </span>
                    </div>
                  </div>

                  {/* ============================================
                      SUGGESTION GRID
                  ============================================ */}

                  <div className="mx-auto mt-8 grid max-w-[760px] grid-cols-1 gap-2 sm:grid-cols-2">

                    {suggestions
                      .slice(0, 4)
                      .map(
                        (
                          suggestion,
                        ) => (
                          <button
                            key={
                              suggestion.label
                            }
                            type="button"
                            disabled={
                              sending
                            }
                            onClick={() =>
                              void askCopilot(
                                suggestion.prompt,
                              )
                            }
                            className="group rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div className="flex items-center justify-between gap-3">

                              <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700">
                                {
                                  suggestion.label
                                }
                              </span>

                              <ArrowDown
                                size={13}
                                className="-rotate-45 text-slate-300 transition group-hover:text-emerald-500"
                              />
                            </div>
                          </button>
                        ),
                      )}
                  </div>
                </div>
              )}

              {/* ==================================================
                  MESSAGES
              ================================================== */}

              <div className="space-y-8">

                {messages.map(
                  (
                    message,
                    index,
                  ) => {
                    const isUser =
                      message.role ===
                      "user";

                    return (
                      <div
                        key={`${index}-${message.role}`}
                        className={`group flex w-full ${
                          isUser
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >

                        {isUser ? (
                          <div className="max-w-[82%] sm:max-w-[72%]">

                            <div className="flex items-center justify-end gap-2 px-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                You
                              </span>
                            </div>

                            <div className="mt-1 rounded-2xl rounded-tr-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm">
                              {message.content
                                .split(
                                  "\n",
                                )
                                .map(
                                  (
                                    line,
                                    lineIndex,
                                  ) => (
                                    <span
                                      key={
                                        lineIndex
                                      }
                                    >
                                      {line}

                                      {lineIndex <
                                        message.content.split(
                                          "\n",
                                        ).length -
                                          1 && (
                                        <br />
                                      )}
                                    </span>
                                  ),
                                )}
                            </div>

                          </div>
                        ) : (
                          <div className="w-full max-w-[820px]">

                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                                <Bot
                                  size={14}
                                />
                              </span>

                              <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                                CarbonTwin
                              </span>

                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </div>

                            <div className="mt-2 pl-0 sm:pl-9">

                              <AssistantContent
                                content={
                                  message.content
                                }
                              />

                              <div className="mt-3 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">

                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyMessage(
                                      message.content,
                                      index,
                                    )
                                  }
                                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Copy response"
                                >
                                  {copiedMessage ===
                                  index ? (
                                    <>
                                      <Check
                                        size={12}
                                      />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Clipboard
                                        size={12}
                                      />
                                      Copy
                                    </>
                                  )}
                                </button>

                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  },
                )}

                {/* ==================================================
                    THINKING
                ================================================== */}

                {sending && (
                  <div className="flex w-full justify-start">
                    <div className="w-full max-w-[820px]">

                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                          <Bot
                            size={14}
                          />
                        </span>

                        <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                          CarbonTwin
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-1 pl-0 sm:pl-9">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
                      </div>

                      <p className="mt-2 pl-0 text-xs text-slate-400 sm:pl-9">
                        Analyzing current CarbonTwin data...
                      </p>
                    </div>
                  </div>
                )}

                <div
                  ref={
                    messagesEndRef
                  }
                />
              </div>
            </div>
          </div>

          {/* ==================================================
              LATEST RESPONSE BUTTON
          ================================================== */}

          {showScrollButton && (
            <button
              type="button"
              onClick={() =>
                scrollToLatest(
                  "smooth",
                )
              }
              className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-[0_5px_20px_rgba(15,23,42,0.12)] transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowDown
                size={13}
              />
              Latest response
            </button>
          )}
        </div>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2.5 sm:px-6">
            <div className="mx-auto flex max-w-[880px] items-center justify-between gap-3">
              <p className="text-xs leading-5 text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  setError(
                    null,
                  )
                }
                className="shrink-0 text-[10px] font-bold text-red-500 hover:text-red-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ====================================================
            COMPOSER
        ==================================================== */}

        <div className="relative z-20 shrink-0 border-t border-slate-100 bg-white px-3 pb-3 pt-3 sm:px-5 sm:pb-4">

          <div className="mx-auto w-full max-w-[880px]">

            {/* ----------------------------------------------
                SUGGESTIONS AFTER CHAT STARTS
            ---------------------------------------------- */}

            {messages.length >
              1 && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {suggestions
                  .slice(0, 5)
                  .map(
                    (
                      suggestion,
                    ) => (
                      <button
                        key={
                          suggestion.label
                        }
                        type="button"
                        disabled={
                          sending
                        }
                        onClick={() =>
                          void askCopilot(
                            suggestion.prompt,
                          )
                        }
                        className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                      >
                        {
                          suggestion.label
                        }
                      </button>
                    ),
                  )}
              </div>
            )}

            {/* ----------------------------------------------
                COMPOSER
            ---------------------------------------------- */}

            <div className="rounded-2xl border border-slate-300 bg-white p-2 shadow-[0_4px_20px_rgba(15,23,42,0.07)] transition focus-within:border-emerald-400 focus-within:shadow-[0_4px_24px_rgba(16,185,129,0.10)]">

              <div className="flex items-end gap-2">

                <textarea
                  ref={
                    textareaRef
                  }
                  value={
                    question
                  }
                  onChange={(
                    event,
                  ) =>
                    setQuestion(
                      event.target
                        .value,
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  rows={1}
                  disabled={
                    sending ||
                    loadingMachines
                  }
                  placeholder={
                    selectedMachine ===
                    "factory"
                      ? "Ask CarbonTwin about your factory..."
                      : `Ask about ${selectedMachineData?.name ?? "this machine"}...`
                  }
                  className="max-h-[150px] min-h-[46px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() =>
                    void askCopilot()
                  }
                  disabled={
                    !question.trim() ||
                    sending ||
                    loadingMachines
                  }
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
                    question.trim() &&
                    !sending
                      ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                  aria-label="Send message"
                >
                  <Send
                    size={17}
                    className={
                      sending
                        ? "animate-pulse"
                        : ""
                    }
                  />
                </button>

              </div>

            </div>

            {/* ----------------------------------------------
                COMPOSER FOOTER
            ---------------------------------------------- */}

            <div className="mt-2 flex items-center justify-between px-1">

              <div className="flex min-w-0 items-center gap-2 text-[9px] text-slate-400">

                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  Live CarbonTwin data
                </span>

                <span className="hidden text-slate-300 sm:inline">
                  ·
                </span>

                <span className="hidden truncate sm:inline">
                  Context:{" "}
                  {
                    activeContext?.label
                  }
                </span>
              </div>

              <span className="hidden text-[9px] text-slate-400 sm:inline">
                Enter to send · Shift + Enter for new line
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}