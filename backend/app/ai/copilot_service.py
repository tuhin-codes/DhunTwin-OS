from __future__ import annotations

import json
import os
import re
from typing import Any

from dotenv import load_dotenv
import google.genai as genai

from app.ai.engine import AIEngine
from app.digital_twin.runtime import DigitalTwinRuntime
from app.services.ai_condition_service import (
    AIConditionService,
)


load_dotenv()


class CopilotService:
    """
    Real conversational AI layer for CarbonTwin OS.

    CarbonTwin is the source of truth for:
        - Digital Twin state
        - live telemetry
        - AI condition
        - predictive failure risk
        - RUL
        - degradation
        - operational condition
        - sustainability

    Gemini is responsible for:
        - natural-language conversation
        - explanation
        - comparison
        - reasoning over CarbonTwin data
        - follow-up questions

    IMPORTANT:

    Gemini does NOT calculate or invent CarbonTwin metrics.

    CarbonTwin computes the current machine/factory state.
    Copilot only explains that state.
    """

    MODEL = "gemini-3.6-flash"

    SYSTEM_INSTRUCTION = """
You are CarbonTwin Copilot, the conversational AI assistant
inside CarbonTwin OS, an enterprise Digital Twin platform.

You help factory operators, maintenance engineers and
decision makers understand the current state of the factory.

============================================================
SOURCE OF TRUTH
============================================================

CarbonTwin is the ONLY source of truth for:

- machine identity
- machine name
- machine type
- live telemetry
- Digital Twin health
- AI health
- predictive failure probability
- 30m / 60m / 120m failure probability
- predictive risk score
- risk level
- RUL
- RUL confidence
- degradation condition
- learned baseline
- operational condition
- maintenance status
- recommended action
- energy
- carbon
- sustainability

Gemini must NOT calculate replacement values.

============================================================
MACHINE CONTEXT RULES
============================================================

1. The section labelled CURRENT CARBONTWIN CONTEXT is authoritative.

2. Conversation history is NOT a source of machine telemetry.

3. Never use an older machine value from conversation history
   when a current CarbonTwin value is available.

4. If a machine is explicitly selected, answer using that machine.

5. If no machine is explicitly selected but the user mentions a
   machine ID or machine name that exists in the CURRENT
   CARBONTWIN CONTEXT, use that machine.

6. If no machine is selected and the user asks a factory-level
   question, use the complete factory context.

7. Never claim that a machine is unavailable if that machine is
   present in the CURRENT CARBONTWIN CONTEXT.

8. Never say that only another machine such as BLR-001 is available
   if the requested machine is present in the supplied context.

============================================================
NUMERICAL ACCURACY
============================================================

9. Never invent telemetry, health scores, predictive probabilities,
   RUL values, risk levels, maintenance states, carbon values,
   energy values or recommendations.

10. When numerical information is supplied, use the exact supplied
    value.

11. Do not recompute or estimate a CarbonTwin value.

12. Predictive failure probability is statistical risk and does not
    guarantee failure.

13. For 30m / 60m / 120m questions, use:

    predictive_failure.probability

14. For overall predictive risk, use:

    predictive_failure.risk_score

15. For AI failure probability, use:

    predictive_failure.ai_failure_probability

16. For RUL, use:

    rul.remaining_useful_life_hours

17. For RUL confidence, use:

    rul.confidence

18. For degradation, use:

    degradation.condition

19. For maintenance action, use:

    operational_condition.action

    or

    predictive_failure.recommended_action

20. Never substitute Digital Twin health score for predictive
    failure probability.

============================================================
RISK PRIORITY
============================================================

When comparing risk:

CRITICAL > HIGH > MEDIUM > LOW > UNKNOWN

Use the actual numerical predictive risk values when available.

============================================================
UNAVAILABLE DATA
============================================================

Only say that a value is unavailable when the CURRENT
CARBONTWIN CONTEXT actually marks that value unavailable,
null, or absent.

Do NOT say "unavailable" merely because:

- no machine was selected in the UI
- the user did not select a machine
- another machine appeared earlier in conversation history
- the factory context contains multiple machines

If the requested machine exists in the factory context,
use its supplied data.

============================================================
FOLLOW-UP QUESTIONS
============================================================

Use conversation history only for conversational continuity.

Always prioritize the newest CURRENT CARBONTWIN CONTEXT
over previous conversational statements.

============================================================
SAFETY
============================================================

You are a decision-support assistant.

Do not claim that a prediction guarantees an outcome.

For critical machine conditions, communicate the supplied
recommended action clearly and remind users to follow qualified
maintenance and safety procedures.

============================================================
RESPONSE STYLE
============================================================

Keep answers concise but useful.

Use:

- headings
- bullets
- tables

when they improve readability.

Do not repeat large amounts of raw JSON unless requested.
"""

    _client: genai.Client | None = None

    # ==========================================================
    # Gemini client
    # ==========================================================

    @classmethod
    def _get_client(cls) -> genai.Client:

        if cls._client is not None:
            return cls._client

        api_key = os.getenv(
            "GEMINI_API_KEY"
        )

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured."
            )

        cls._client = genai.Client(
            api_key=api_key
        )

        return cls._client

    # ==========================================================
    # Machine context
    # ==========================================================

    @classmethod
    def _machine_context(
        cls,
        machine,
    ) -> dict[str, Any]:

        machine_id = str(
            machine.id
        )

        # ------------------------------------------------------
        # AUTHORITATIVE AI CONDITION
        # ------------------------------------------------------

        try:

            ai_condition = (
                AIConditionService.analyze(
                    machine_id
                )
            )

        except Exception as exc:

            ai_condition = {
                "available": False,
                "reason": (
                    "AI condition analysis unavailable: "
                    f"{exc}"
                ),
            }

        # ------------------------------------------------------
        # BASIC DIGITAL TWIN STATE
        # ------------------------------------------------------

        machine_type = getattr(
            machine,
            "machine_type",
            getattr(
                machine,
                "type",
                "Unknown",
            ),
        )

        machine_name = getattr(
            machine,
            "name",
            machine_id,
        )

        basic_machine = {

            "machine_id": machine_id,

            "machine_name": machine_name,

            "machine_type": machine_type,

            "department": getattr(
                machine,
                "department",
                None,
            ),

            "health_score": getattr(
                machine,
                "health_score",
                None,
            ),

            "maintenance_status": getattr(
                machine,
                "maintenance_status",
                None,
            ),

            "operating_state": getattr(
                machine,
                "operating_state",
                None,
            ),

            "telemetry": {

                "air_temperature": getattr(
                    machine,
                    "air_temperature",
                    None,
                ),

                "process_temperature": getattr(
                    machine,
                    "process_temperature",
                    None,
                ),

                "rpm": getattr(
                    machine,
                    "rpm",
                    None,
                ),

                "torque": getattr(
                    machine,
                    "torque",
                    None,
                ),

                "tool_wear": getattr(
                    machine,
                    "tool_wear",
                    None,
                ),

                "temperature": getattr(
                    machine,
                    "temperature",
                    None,
                ),

                "pressure": getattr(
                    machine,
                    "pressure",
                    None,
                ),

                "vibration": getattr(
                    machine,
                    "vibration",
                    None,
                ),

                "power": getattr(
                    machine,
                    "power",
                    None,
                ),
            },
        }

        return {
            **basic_machine,

            "ai_condition": ai_condition,
        }

    # ==========================================================
    # Factory context
    # ==========================================================

    @classmethod
    def _factory_context(
        cls,
    ) -> dict[str, Any]:

        machines = (
            DigitalTwinRuntime.machines()
        )

        machine_context = []

        for machine in machines:

            machine_context.append(
                cls._machine_context(
                    machine
                )
            )

        # ------------------------------------------------------
        # Sustainability
        # ------------------------------------------------------

        try:

            sustainability = (
                AIEngine.sustainability()
            )

        except Exception as exc:

            sustainability = {
                "error": (
                    "Sustainability analysis unavailable: "
                    f"{exc}"
                ),
            }

        # ------------------------------------------------------
        # Predictive summary
        # ------------------------------------------------------

        risk_distribution = {
            "CRITICAL": 0,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
            "UNKNOWN": 0,
        }

        predictive_results = []

        for machine in machine_context:

            ai_condition = machine.get(
                "ai_condition",
                {},
            )

            if not isinstance(
                ai_condition,
                dict,
            ):
                continue

            predictive = ai_condition.get(
                "predictive_failure",
                {},
            )

            if not isinstance(
                predictive,
                dict,
            ):
                continue

            if not predictive.get(
                "available",
                False,
            ):
                continue

            risk_level = str(
                predictive.get(
                    "risk_level",
                    "UNKNOWN",
                )
            ).upper()

            if risk_level not in risk_distribution:
                risk_level = "UNKNOWN"

            risk_distribution[
                risk_level
            ] += 1

            rul = ai_condition.get(
                "rul",
                {},
            )

            if not isinstance(
                rul,
                dict,
            ):
                rul = {}

            predictive_results.append(
                {
                    "machine_id": machine.get(
                        "machine_id"
                    ),

                    "machine_name": machine.get(
                        "machine_name"
                    ),

                    "risk_level": risk_level,

                    "risk_score": predictive.get(
                        "risk_score"
                    ),

                    "ai_failure_probability": (
                        predictive.get(
                            "ai_failure_probability"
                        )
                    ),

                    "probability": predictive.get(
                        "probability"
                    ),

                    "rul_hours": rul.get(
                        "remaining_useful_life_hours"
                    ),

                    "rul_confidence": rul.get(
                        "confidence"
                    ),

                    "degradation_condition": (
                        predictive.get(
                            "degradation_condition"
                        )
                    ),

                    "recommended_action": (
                        predictive.get(
                            "recommended_action"
                        )
                    ),
                }
            )

        predictive_results.sort(
            key=lambda item: float(
                item.get(
                    "risk_score"
                )
                or 0
            ),
            reverse=True,
        )

        return {

            "context_type": "FACTORY",

            "machine_count": len(
                machines
            ),

            "machines": machine_context,

            "predictive_summary": {

                "machines_with_prediction": len(
                    predictive_results
                ),

                "risk_distribution": (
                    risk_distribution
                ),

                "highest_risk_machines": (
                    predictive_results[:5]
                ),
            },

            "sustainability": sustainability,
        }

    # ==========================================================
    # Resolve machine mentioned in user message
    # ==========================================================

    @classmethod
    def _resolve_machine_from_message(
        cls,
        message: str,
    ) -> str | None:

        normalized_message = (
            message.lower()
        )

        machines = (
            DigitalTwinRuntime.machines()
        )

        # ------------------------------------------------------
        # First: exact machine ID matching.
        #
        # Example:
        #
        # "risk for MTR-001"
        # ------------------------------------------------------

        for machine in machines:

            machine_id = str(
                machine.id
            )

            if machine_id.lower() in normalized_message:

                return machine_id

        # ------------------------------------------------------
        # Second: machine name matching.
        # ------------------------------------------------------

        for machine in machines:

            machine_name = str(
                getattr(
                    machine,
                    "name",
                    "",
                )
            ).strip()

            if (
                machine_name
                and machine_name.lower()
                in normalized_message
            ):

                return str(
                    machine.id
                )

        # ------------------------------------------------------
        # Third: conservative pattern matching for machine IDs.
        #
        # This handles IDs embedded in punctuation.
        # ------------------------------------------------------

        machine_ids = {
            str(machine.id).lower(): str(machine.id)
            for machine in machines
        }

        matches = re.findall(
            r"\b[A-Za-z]{2,10}-\d{3,6}\b",
            message,
        )

        for match in matches:

            machine_id = machine_ids.get(
                match.lower()
            )

            if machine_id:
                return machine_id

        return None

    # ==========================================================
    # Context builder
    # ==========================================================

    @classmethod
    def build_context(
        cls,
        machine_id: str | None = None,
        user_message: str | None = None,
    ) -> dict[str, Any]:

        # ------------------------------------------------------
        # Explicitly selected machine always wins.
        #
        # This produces ONE authoritative snapshot for the
        # selected machine during this Copilot request.
        # ------------------------------------------------------

        if machine_id:

            machine = (
                DigitalTwinRuntime.get(
                    machine_id
                )
            )

            if machine is None:

                raise ValueError(
                    f"Machine '{machine_id}' not found."
                )

            machine_snapshot = (
                cls._machine_context(
                    machine
                )
            )

            return {

                "scope": "machine",

                "context_source": (
                    "CarbonTwin AIConditionService"
                ),

                "machine": machine_snapshot,
            }

        # ------------------------------------------------------
        # No machine selected.
        #
        # Build the complete factory context ONCE.
        #
        # IMPORTANT:
        #
        # We do NOT call _machine_context() a second time
        # if the user mentions a machine.
        #
        # This guarantees that the machine-specific context
        # and factory context use the SAME snapshot for this
        # Copilot request.
        # ------------------------------------------------------

        factory = (
            cls._factory_context()
        )

        context = {

            "scope": "factory",

            "context_source": (
                "CarbonTwin AIConditionService"
            ),

            "factory": factory,
        }

        # ------------------------------------------------------
        # If the user explicitly mentions a machine, identify it
        # from the CURRENT factory registry.
        # ------------------------------------------------------

        if user_message:

            resolved_machine_id = (
                cls._resolve_machine_from_message(
                    user_message
                )
            )

            if resolved_machine_id:

                # --------------------------------------------------
                # REUSE THE MACHINE SNAPSHOT ALREADY CREATED
                # INSIDE _factory_context().
                #
                # DO NOT call _machine_context() again here.
                # --------------------------------------------------

                requested_machine = None

                factory_machines = factory.get(
                    "machines",
                    [],
                )

                if isinstance(
                    factory_machines,
                    list,
                ):

                    for machine_snapshot in (
                        factory_machines
                    ):

                        if not isinstance(
                            machine_snapshot,
                            dict,
                        ):
                            continue

                        if str(
                            machine_snapshot.get(
                                "machine_id",
                                "",
                            )
                        ).lower() == resolved_machine_id.lower():

                            requested_machine = (
                                machine_snapshot
                            )

                            break

                # --------------------------------------------------
                # The machine should normally always be found
                # because _resolve_machine_from_message() uses
                # DigitalTwinRuntime.machines().
                #
                # Keep the fallback defensive, but DO NOT silently
                # claim that the machine is unavailable.
                # --------------------------------------------------

                if requested_machine is not None:

                    context[
                        "requested_machine_id"
                    ] = resolved_machine_id

                    context[
                        "requested_machine"
                    ] = requested_machine

        return context

    # ==========================================================
    # Prompt builder
    # ==========================================================

    @classmethod
    def _build_prompt(
        cls,
        message: str,
        context: dict[str, Any],
        history: list[dict[str, str]] | None = None,
    ) -> str:

        history = history or []

        recent_history = history[-12:]

        conversation_lines = []

        for item in recent_history:

            role = str(
                item.get(
                    "role",
                    "user",
                )
            ).upper()

            content = str(
                item.get(
                    "content",
                    "",
                )
            ).strip()

            if not content:
                continue

            conversation_lines.append(
                f"{role}: {content}"
            )

        conversation_text = "\n".join(
            conversation_lines
        )

        # ------------------------------------------------------
        # Explicit instruction when a machine was inferred.
        # ------------------------------------------------------

        requested_machine_instruction = ""

        if context.get(
            "requested_machine_id"
        ):

            requested_machine_instruction = f"""
REQUESTED MACHINE
=================

The user mentioned machine:

{context["requested_machine_id"]}

This machine was found directly in the CURRENT
CarbonTwin machine registry.

The "requested_machine" object is the authoritative
machine-specific snapshot for this request.

IMPORTANT:
The "requested_machine" object and the matching machine
inside "factory.machines" were generated from the SAME
CarbonTwin context build.

Use "requested_machine" for machine-specific answers.

Do NOT say this machine is unavailable.

Do NOT use another machine's values instead.

Do NOT use older values from conversation history.
"""

        return f"""
CURRENT CARBONTWIN CONTEXT
==========================

THIS SECTION IS THE AUTHORITATIVE CURRENT STATE.

Never replace it with older information from conversation
history.

{json.dumps(
    context,
    indent=2,
    default=str,
)}

{requested_machine_instruction}

CONVERSATION HISTORY
====================

Conversation history is provided ONLY for conversational
continuity.

It is NOT authoritative for current telemetry,
predictive probabilities, RUL, health, risk or maintenance.

{conversation_text or "No previous conversation."}

CURRENT USER MESSAGE
====================

{message}

RESPONSE REQUIREMENTS
=====================

Answer the current user question using CURRENT
CARBONTWIN CONTEXT.

IMPORTANT:

1. If "requested_machine" exists, use it for the machine
   mentioned by the user.

2. If no requested_machine exists and the question is
   factory-level, use the factory context.

3. If the user asks for exact predictive values, report
   the exact supplied values.

4. For 30m / 60m / 120m use:

   ai_condition.predictive_failure.probability

5. For overall risk use:

   ai_condition.predictive_failure.risk_score

6. For risk level use:

   ai_condition.predictive_failure.risk_level

7. For RUL use:

   ai_condition.rul.remaining_useful_life_hours

8. For confidence use:

   ai_condition.rul.confidence

9. For degradation use:

   ai_condition.degradation.condition

10. For recommended action use:

    ai_condition.operational_condition.action

    or

    ai_condition.predictive_failure.recommended_action

11. If a requested machine exists in CURRENT CONTEXT,
    never claim that its data is unavailable.

12. Only report a value as unavailable if the CURRENT
    CONTEXT actually says it is unavailable/null/missing.

13. Never estimate or calculate a replacement value.

14. Never use Digital Twin health score as a replacement
    for predictive failure probability.

15. For factory comparisons, compare actual predictive
    risk_score values.

16. Keep the answer concise and professional.
"""

    # ==========================================================
    # Chat
    # ==========================================================

    @classmethod
    def chat(
        cls,
        message: str,
        history: list[dict[str, str]] | None = None,
        machine_id: str | None = None,
    ) -> dict[str, Any]:

        message = message.strip()

        if not message:

            raise ValueError(
                "Message cannot be empty."
            )

        # ------------------------------------------------------
        # Build ONE authoritative CarbonTwin context.
        #
        # user_message is passed so that:
        #
        # machine_id = None
        #
        # + user asks about MTR-001
        #
        # still gets exact MTR-001 context without running
        # AIConditionService.analyze() a second time.
        # ------------------------------------------------------

        context = cls.build_context(
            machine_id=machine_id,
            user_message=message,
        )

        prompt = cls._build_prompt(
            message=message,
            context=context,
            history=history,
        )

        client = cls._get_client()

        response = (
            client.models.generate_content(
                model=cls.MODEL,
                contents=prompt,
                config={
                    "system_instruction": (
                        cls.SYSTEM_INSTRUCTION
                    ),
                    "temperature": 0.1,
                },
            )
        )

        answer = (
            response.text.strip()
            if response.text
            else (
                "I could not generate a response "
                "from the current CarbonTwin data."
            )
        )

        return {

            "success": True,

            "model": cls.MODEL,

            "message": message,

            "answer": answer,

            "scope": context.get(
                "scope",
                "factory",
            ),

            "machine_id": (
                machine_id
                or context.get(
                    "requested_machine_id"
                )
            ),
        }