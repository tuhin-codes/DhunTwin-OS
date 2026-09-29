import json
from pathlib import Path
from typing import Any

from app.models.machine import Machine


class MaintenanceService:

    TECHNICIANS_FILE = (
        Path(__file__).resolve().parent.parent
        / "data"
        / "technicians.json"
    )

    HISTORY_FILE = (
        Path(__file__).resolve().parent.parent
        / "data"
        / "maintenance_history.json"
    )

    # ============================================================
    # DATA LOADING
    # ============================================================

    @classmethod
    def _load_json(
        cls,
        path: Path,
    ) -> dict[str, Any]:

        if not path.exists():
            return {}

        try:
            with open(
                path,
                "r",
                encoding="utf-8",
            ) as file:
                data = json.load(file)

            if isinstance(data, dict):
                return data

            return {}

        except (
            OSError,
            json.JSONDecodeError,
        ):
            return {}

    @classmethod
    def _load_technicians(
        cls,
    ) -> list[dict[str, Any]]:

        data = cls._load_json(
            cls.TECHNICIANS_FILE
        )

        technicians = data.get(
            "technicians",
            [],
        )

        if isinstance(
            technicians,
            list,
        ):
            return technicians

        return []

    @classmethod
    def _load_history(
        cls,
    ) -> list[dict[str, Any]]:

        data = cls._load_json(
            cls.HISTORY_FILE
        )

        history = data.get(
            "maintenance_history",
            [],
        )

        if isinstance(
            history,
            list,
        ):
            return history

        return []

    # ============================================================
    # HELPERS
    # ============================================================

    @staticmethod
    def _normalize(
        value: Any,
    ) -> str:

        if value is None:
            return ""

        return str(value).strip().lower()

    # ============================================================
    # ASSIGNMENT HELPERS
    # ============================================================

    @classmethod
    def _assigned_machine_ids(
        cls,
        technician: dict[str, Any],
    ) -> list[str]:

        """
        Return every machine currently assigned to a technician.

        Supports both the legacy:
            assigned_machine

        and the newer:
            assignments

        structures.
        """

        machine_ids: list[str] = []

        # --------------------------------------------------------
        # Legacy / primary assignment
        # --------------------------------------------------------

        assigned_machine = technician.get(
            "assigned_machine"
        )

        if assigned_machine:

            machine_id = str(
                assigned_machine
            ).strip()

            if machine_id:

                machine_ids.append(
                    machine_id
                )

        # --------------------------------------------------------
        # Multiple assignments
        # --------------------------------------------------------

        assignments = technician.get(
            "assignments",
            [],
        )

        if isinstance(
            assignments,
            list,
        ):

            for assignment in assignments:

                if not isinstance(
                    assignment,
                    dict,
                ):
                    continue

                machine_id = assignment.get(
                    "machine_id"
                )

                if not machine_id:
                    continue

                machine_id = str(
                    machine_id
                ).strip()

                if (
                    machine_id
                    and machine_id
                    not in machine_ids
                ):

                    machine_ids.append(
                        machine_id
                    )

        return machine_ids

    @classmethod
    def _assignment_status(
        cls,
        machine: Machine,
        technician: dict[str, Any],
    ) -> tuple[bool, str]:

        """
        Determine whether a technician already has an active
        machine assignment.

        The assignment model is intentionally conservative:
        a technician with an active assignment is not presented
        as a fresh recommendation.

        This prevents the recommendation engine from suggesting
        an engineer who is already occupied elsewhere.
        """

        assigned_machine_ids = (
            cls._assigned_machine_ids(
                technician
            )
        )

        if not assigned_machine_ids:

            return (
                False,
                "",
            )

        machine_id = str(
            machine.id
        ).strip()

        # --------------------------------------------------------
        # Same machine
        # --------------------------------------------------------

        if machine_id in assigned_machine_ids:

            return (
                True,
                (
                    "Already assigned to "
                    f"machine {machine.id}"
                ),
            )

        # --------------------------------------------------------
        # Another machine
        # --------------------------------------------------------

        return (
            True,
            (
                "Already assigned to machine "
                f"{assigned_machine_ids[0]}"
            ),
        )

    # ============================================================
    # MACHINE SKILLS
    # ============================================================

    @classmethod
    def _required_skills(
        cls,
        machine: Machine,
    ) -> list[str]:

        machine_type = cls._normalize(
            machine.type
        )

        skill_map = {

            "boiler": [
                "Boiler",
                "Thermal Systems",
                "Pressure Systems",
                "Preventive Maintenance",
            ],

            "pump": [
                "Pump",
                "Hydraulics",
                "Fluid Systems",
                "Mechanical Maintenance",
            ],

            "motor": [
                "Motor",
                "Electrical Systems",
                "Drives",
                "Vibration Analysis",
            ],

            "compressor": [
                "Compressor",
                "Pneumatics",
                "Pressure Systems",
                "Mechanical Maintenance",
            ],

            "cnc": [
                "CNC",
                "Mechanical",
                "Vibration Analysis",
                "Preventive Maintenance",
            ],

            "robot": [
                "Automation",
                "Robotics",
                "Sensors",
                "PLC",
            ],
        }

        return skill_map.get(
            machine_type,
            [
                "Mechanical",
                "Preventive Maintenance",
            ],
        )

    # ============================================================
    # PROBLEM IDENTIFICATION
    # ============================================================

    @classmethod
    def identify_problem(
        cls,
        machine: Machine,
    ) -> dict[str, Any]:

        problems: list[str] = []

        severity = "Normal"

        # --------------------------------------------------------
        # Health
        # --------------------------------------------------------

        if machine.health_score < 50:
            severity = "Critical"

        elif machine.health_score < 75:
            severity = "High"

        elif machine.health_score < 90:
            severity = "Medium"

        # --------------------------------------------------------
        # Failure risk
        # --------------------------------------------------------

        if machine.failure_probability >= 75:

            problems.append(
                "High predicted failure risk"
            )

        elif machine.failure_probability >= 40:

            problems.append(
                "Elevated predicted failure risk"
            )

        # --------------------------------------------------------
        # Vibration
        # --------------------------------------------------------

        if machine.vibration >= 2.0:

            problems.append(
                "Abnormal vibration"
            )

        elif machine.vibration >= 1.5:

            problems.append(
                "Elevated vibration"
            )

        # --------------------------------------------------------
        # Temperature
        # --------------------------------------------------------

        if machine.temperature >= 210:

            problems.append(
                "High operating temperature"
            )

        elif machine.temperature >= 195:

            problems.append(
                "Elevated operating temperature"
            )

        # --------------------------------------------------------
        # Pressure
        # --------------------------------------------------------

        if machine.pressure < 6.5:

            problems.append(
                "Low operating pressure"
            )

        # --------------------------------------------------------
        # Efficiency
        # --------------------------------------------------------

        if machine.efficiency < 75:

            problems.append(
                "Low operating efficiency"
            )

        elif machine.efficiency < 90:

            problems.append(
                "Reduced operating efficiency"
            )

        # --------------------------------------------------------
        # Health degradation
        # --------------------------------------------------------

        if machine.health_score < 75:

            problems.append(
                "Machine health degradation"
            )

        # --------------------------------------------------------
        # Maintenance state
        # --------------------------------------------------------

        if machine.maintenance_status in {
            "Needs Attention",
            "Maintenance",
        }:

            problems.append(
                "Maintenance intervention required"
            )

        # --------------------------------------------------------
        # No abnormal condition
        # --------------------------------------------------------

        if not problems:

            problems.append(
                "Preventive maintenance / monitoring"
            )

        return {
            "severity": severity,
            "problems": problems,
        }

    # ============================================================
    # PROBLEM CATEGORIES
    # ============================================================

    @classmethod
    def _problem_categories(
        cls,
        machine: Machine,
    ) -> list[str]:

        categories: list[str] = []

        if machine.temperature >= 210:

            categories.append(
                "temperature"
            )

        elif machine.temperature >= 195:

            categories.append(
                "temperature"
            )

        if machine.vibration >= 2.0:

            categories.append(
                "vibration"
            )

        elif machine.vibration >= 1.5:

            categories.append(
                "vibration"
            )

        if machine.pressure < 6.5:

            categories.append(
                "pressure"
            )

        if machine.efficiency < 90:

            categories.append(
                "efficiency"
            )

        if machine.failure_probability >= 40:

            categories.append(
                "failure risk"
            )

        if machine.health_score < 75:

            categories.append(
                "health"
            )

        if machine.maintenance_status in {
            "Needs Attention",
            "Maintenance",
        }:

            categories.append(
                "maintenance"
            )

        # --------------------------------------------------------
        # Healthy machine
        # --------------------------------------------------------

        if not categories:

            categories.append(
                "preventive maintenance"
            )

        return categories

    # ============================================================
    # HISTORICAL EXPERIENCE
    # ============================================================

    @staticmethod
    def _normalize_problem_type(
        value: Any,
    ) -> str:

        """
        Normalize a maintenance problem label for comparison.

        Only safe textual normalization is performed:
        case, surrounding whitespace, and repeated whitespace.
        No fuzzy semantic matching is performed.
        """

        return " ".join(
            str(value or "").strip().lower().split()
        )

    @classmethod
    def _historical_experience(
        cls,
        machine: Machine,
        technician_id: str,
    ) -> dict[str, Any]:

        history = cls._load_history()

        machine_type = cls._normalize_problem_type(
            machine.type
        )

        categories = {
            cls._normalize_problem_type(category)
            for category in cls._problem_categories(machine)
        }

        # ========================================================
        # PASS 1
        #
        # First look for records matching:
        #   technician + machine type + problem category
        #
        # This is the strongest historical evidence.
        # ========================================================

        problem_matched_records: list[
            dict[str, Any]
        ] = []

        machine_history_records: list[
            dict[str, Any]
        ] = []

        for record in history:

            if not isinstance(
                record,
                dict,
            ):
                continue

            record_technician_id = str(
                record.get(
                    "technician_id",
                    "",
                )
            ).strip()

            if (
                record_technician_id
                != str(
                    technician_id
                ).strip()
            ):
                continue

            record_machine_type = (
                cls._normalize_problem_type(
                    record.get(
                        "machine_type",
                        "",
                    )
                )
            )

            if (
                record_machine_type
                != machine_type
            ):
                continue

            # Valid technician + machine-type history.
            machine_history_records.append(
                record
            )

            record_problem = (
                cls._normalize_problem_type(
                    record.get(
                        "problem_type",
                        "",
                    )
                )
            )

            if not record_problem:
                continue

            problem_match = any(
                category
                and (
                    category in record_problem
                    or record_problem in category
                )
                for category in categories
            )

            if problem_match:
                problem_matched_records.append(
                    record
                )

        # ========================================================
        # PASS 2 / FALLBACK
        #
        # A live predictive state can contain categories such as:
        #   "failure risk"
        #   "health"
        #   "maintenance"
        #
        # Historical records may instead contain the physical
        # root cause:
        #   "High Vibration"
        #   "Electrical Fault"
        #
        # If none of the historical problem labels match the
        # current broad categories, do NOT throw away valid
        # technician + machine-type experience.
        #
        # Use the complete machine-type history as fallback.
        # ========================================================

        if problem_matched_records:

            relevant_records = (
                problem_matched_records
            )

        else:

            relevant_records = (
                machine_history_records
            )

        # ========================================================
        # Historical statistics
        # ========================================================

        successful_cases = sum(
            1
            for record
            in relevant_records
            if bool(
                record.get(
                    "successful",
                    False,
                )
            )
        )

        repeat_failures = sum(
            1
            for record
            in relevant_records
            if bool(
                record.get(
                    "repeat_failure",
                    False,
                )
            )
        )

        total_cases = len(
            relevant_records
        )

        success_rate = 0.0

        if total_cases > 0:

            success_rate = round(
                (
                    successful_cases
                    / total_cases
                )
                * 100,
                1,
            )

        return {
            "similar_cases":
                total_cases,

            "successful_cases":
                successful_cases,

            "repeat_failures":
                repeat_failures,

            "success_rate":
                success_rate,

            "records":
                relevant_records,
        }

    # ============================================================
    # ELIGIBILITY
    # ============================================================

    @classmethod
    def _is_eligible(
        cls,
        technician: dict[str, Any],
    ) -> tuple[bool, str]:

        availability = cls._normalize(
            technician.get(
                "availability"
            )
        )

        workload = int(
            technician.get(
                "current_workload",
                0,
            )
            or 0
        )

        max_workload = int(
            technician.get(
                "max_workload",
                1,
            )
            or 1
        )

        if availability != "available":

            return (
                False,
                "Technician is unavailable",
            )

        if max_workload <= 0:

            return (
                False,
                "Technician has invalid workload capacity",
            )

        if workload >= max_workload:

            return (
                False,
                "Technician workload is full",
            )

        return (
            True,
            "Technician is available",
        )

    # ============================================================
    # TECHNICIAN RELEVANCE
    # ============================================================

    @classmethod
    def _relevance(
        cls,
        machine: Machine,
        technician: dict[str, Any],
    ) -> dict[str, Any]:

        # --------------------------------------------------------
        # Required skills
        # --------------------------------------------------------

        required_skills = {
            cls._normalize(skill)
            for skill in cls._required_skills(
                machine
            )
        }

        technician_skills = {
            cls._normalize(skill)
            for skill in technician.get(
                "skills",
                [],
            )
        }

        matched_skills = sorted(
            required_skills.intersection(
                technician_skills
            )
        )

        missing_skills = sorted(
            required_skills.difference(
                technician_skills
            )
        )

        # --------------------------------------------------------
        # Department
        # --------------------------------------------------------

        machine_department = (
            cls._normalize(
                machine.department
            )
        )

        technician_department = (
            cls._normalize(
                technician.get(
                    "department",
                    "",
                )
            )
        )

        same_department = (
            bool(machine_department)
            and
            machine_department
            == technician_department
        )

        # --------------------------------------------------------
        # Machine specialization
        # --------------------------------------------------------

        machine_type = cls._normalize(
            machine.type
        )

        specialization = (
            cls._normalize(
                technician.get(
                    "specialization",
                    "",
                )
            )
        )

        specialization_match = (
            machine_type in specialization
            or any(
                machine_type
                in cls._normalize(skill)
                for skill
                in technician.get(
                    "skills",
                    [],
                )
            )
        )

        # --------------------------------------------------------
        # Experience
        # --------------------------------------------------------

        experience = int(
            technician.get(
                "experience_years",
                0,
            )
            or 0
        )

        # --------------------------------------------------------
        # Historical experience
        # --------------------------------------------------------

        technician_id = str(
            technician.get(
                "id",
                "",
            )
        )

        history = (
            cls._historical_experience(
                machine,
                technician_id,
            )
        )

        # ========================================================
        # Evidence
        # ========================================================

        evidence: list[str] = []

        if matched_skills:

            evidence.append(
                "Relevant skills: "
                + ", ".join(
                    matched_skills
                )
            )

        if specialization_match:

            evidence.append(
                "Specialization is relevant "
                "to this machine type"
            )

        if same_department:

            evidence.append(
                "Works in the same department"
            )

        if experience > 0:

            evidence.append(
                f"{experience} years of experience"
            )

        if history[
            "similar_cases"
        ] > 0:

            evidence.append(
                "Handled "
                f"{history['similar_cases']} "
                "relevant historical case(s)"
            )

        if history[
            "successful_cases"
        ] > 0:

            evidence.append(
                f"{history['successful_cases']} "
                "relevant case(s) were successful"
            )

        if history[
            "repeat_failures"
        ] > 0:

            evidence.append(
                f"{history['repeat_failures']} "
                "historical case(s) had repeat failure"
            )

        workload = int(
            technician.get(
                "current_workload",
                0,
            )
            or 0
        )

        max_workload = int(
            technician.get(
                "max_workload",
                1,
            )
            or 1
        )

        evidence.append(
            f"Current workload: "
            f"{workload}/{max_workload}"
        )

        # ========================================================
        # Relevance classification
        # ========================================================

        similar_cases = history[
            "similar_cases"
        ]

        successful_cases = history[
            "successful_cases"
        ]

        # --------------------------------------------------------
        # Very High
        # --------------------------------------------------------

        if (
            len(matched_skills) >= 3
            and specialization_match
            and similar_cases > 0
            and successful_cases > 0
        ):

            relevance = "Very High"

        # --------------------------------------------------------
        # High
        # --------------------------------------------------------

        elif (
            len(matched_skills) >= 3
            and specialization_match
        ):

            relevance = "High"

        elif (
            specialization_match
            and similar_cases > 0
            and successful_cases > 0
        ):

            relevance = "High"

        # --------------------------------------------------------
        # Medium
        # --------------------------------------------------------

        elif (
            len(matched_skills) >= 2
            or specialization_match
            or similar_cases > 0
        ):

            relevance = "Medium"

        # --------------------------------------------------------
        # Low
        # --------------------------------------------------------

        elif matched_skills:

            relevance = "Low"

        # --------------------------------------------------------
        # Poor
        # --------------------------------------------------------

        else:

            relevance = "Poor"

        return {
            "relevance":
                relevance,

            "matched_skills":
                matched_skills,

            "missing_skills":
                missing_skills,

            "same_department":
                same_department,

            "specialization_match":
                specialization_match,

            "experience_years":
                experience,

            "historical_experience":
                history,

            "evidence":
                evidence,
        }

    # ============================================================
    # RECOMMENDATIONS
    # ============================================================

    @classmethod
    def recommend(
        cls,
        machine: Machine,
        limit: int = 3,
    ) -> dict[str, Any]:

        technicians = (
            cls._load_technicians()
        )

        problem = (
            cls.identify_problem(
                machine
            )
        )

        required_skills = (
            cls._required_skills(
                machine
            )
        )

        recommendations: list[
            dict[str, Any]
        ] = []

        excluded: list[
            dict[str, Any]
        ] = []

        # ========================================================
        # Evaluate every technician
        # ========================================================

        for technician in technicians:

            technician_id = str(
                technician.get(
                    "id",
                    "",
                )
            )

            technician_name = technician.get(
                "name",
                "Unknown",
            )

            # ----------------------------------------------------
            # Assignment check
            # ----------------------------------------------------

            already_assigned, assignment_reason = (
                cls._assignment_status(
                    machine,
                    technician,
                )
            )

            if already_assigned:

                excluded.append(
                    {
                        "technician_id":
                            technician_id,

                        "technician":
                            technician_name,

                        "reason":
                            assignment_reason,
                    }
                )

                continue

            # ----------------------------------------------------
            # Availability / workload
            # ----------------------------------------------------

            eligible, reason = (
                cls._is_eligible(
                    technician
                )
            )

            if not eligible:

                excluded.append(
                    {
                        "technician_id":
                            technician_id,

                        "technician":
                            technician_name,

                        "reason":
                            reason,
                    }
                )

                continue

            # ----------------------------------------------------
            # Technical relevance
            # ----------------------------------------------------

            relevance = (
                cls._relevance(
                    machine,
                    technician,
                )
            )

            # ----------------------------------------------------
            # Workforce role
            #
            # Keep the actual workforce role in the recommendation
            # payload so downstream work-order assignment validation
            # can verify the operator's selection against the same
            # workforce record used for recommendation.
            # ----------------------------------------------------

            raw_role = str(
                technician.get(
                    "role",
                    "",
                )
                or ""
            ).strip()

            role_type = "UNKNOWN"

            if "engineer" in raw_role.lower():
                role_type = "ENGINEER"

            elif "technician" in raw_role.lower():
                role_type = "TECHNICIAN"

            recommendations.append(
                {
                    "technician_id":
                        technician_id,

                    "technician":
                        technician_name,

                    "role":
                        raw_role,

                    "role_type":
                        role_type,

                    "specialization":
                        technician.get(
                            "specialization"
                        ),

                    "department":
                        technician.get(
                            "department"
                        ),

                    "availability":
                        technician.get(
                            "availability"
                        ),

                    "current_workload":
                        technician.get(
                            "current_workload"
                        ),

                    "max_workload":
                        technician.get(
                            "max_workload"
                        ),

                    "relevance":
                        relevance[
                            "relevance"
                        ],

                    "matched_skills":
                        relevance[
                            "matched_skills"
                        ],

                    "missing_skills":
                        relevance[
                            "missing_skills"
                        ],

                    "same_department":
                        relevance[
                            "same_department"
                        ],

                    "specialization_match":
                        relevance[
                            "specialization_match"
                        ],

                    "experience_years":
                        relevance[
                            "experience_years"
                        ],

                    "historical_experience":
                        relevance[
                            "historical_experience"
                        ],

                    "evidence":
                        relevance[
                            "evidence"
                        ],
                }
            )

        # ========================================================
        # Ranking
        # ========================================================

        relevance_order = {
            "Very High": 4,
            "High": 3,
            "Medium": 2,
            "Low": 1,
            "Poor": 0,
        }

        recommendations.sort(
            key=lambda item: (
                relevance_order.get(
                    item["relevance"],
                    0,
                ),

                item[
                    "historical_experience"
                ][
                    "successful_cases"
                ],

                item[
                    "historical_experience"
                ][
                    "similar_cases"
                ],

                len(
                    item[
                        "matched_skills"
                    ]
                ),

                int(
                    item[
                        "specialization_match"
                    ]
                ),

                int(
                    item[
                        "same_department"
                    ]
                ),

                item[
                    "experience_years"
                ],
            ),
            reverse=True,
        )

        # ========================================================
        # Final response
        # ========================================================

        return {
            "machine": {
                "id":
                    machine.id,

                "name":
                    machine.name,

                "type":
                    machine.type,

                "department":
                    machine.department,

                "health_score":
                    machine.health_score,

                "failure_probability":
                    machine.failure_probability,

                "maintenance_status":
                    machine.maintenance_status,
            },

            "maintenance_problem":
                problem,

            "required_skills":
                required_skills,

            "recommended_engineer":
                (
                    recommendations[0]
                    if recommendations
                    else None
                ),

            "recommendations":
                recommendations[:limit],

            "excluded_engineers":
                excluded,

            "scoring_note":
                (
                    "Recommendations use technician "
                    "skills, role, specialization, department, "
                    "availability, experience, historical "
                    "maintenance outcomes, and current "
                    "machine assignments. Technicians "
                    "already assigned to an active machine "
                    "are excluded from new recommendations. "
                    "No artificial AI probability is "
                    "reported."
                ),
        }

    # ============================================================
    # ALL TECHNICIANS
    # ============================================================

    @classmethod
    def technicians(
        cls,
    ) -> list[dict[str, Any]]:

        return cls._load_technicians()