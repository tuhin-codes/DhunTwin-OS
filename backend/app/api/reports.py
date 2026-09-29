from __future__ import annotations

from io import BytesIO
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    getSampleStyleSheet,
    ParagraphStyle,
)
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)

from app.digital_twin.runtime import DigitalTwinRuntime
from app.services.predictive_maintenance_service import (
    PredictiveMaintenanceService,
)
from app.digital_twin.telemetry_history import LiveTelemetryStore


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


# ============================================================
# CARBONTWIN OS COLORS
# ============================================================

GREEN = colors.HexColor("#087443")
GREEN_DARK = colors.HexColor("#065C35")
GREEN_LIGHT = colors.HexColor("#ECFDF5")
GREEN_BORDER = colors.HexColor("#A7F3D0")

TEXT = colors.HexColor("#15211B")
TEXT_SECONDARY = colors.HexColor("#64736A")
TEXT_MUTED = colors.HexColor("#94A39A")

BACKGROUND = colors.HexColor("#F7FAF8")
BACKGROUND_SOFT = colors.HexColor("#FBFDFC")
BORDER = colors.HexColor("#DDE7E1")

RED = colors.HexColor("#DC2626")
RED_LIGHT = colors.HexColor("#FEF2F2")
RED_BORDER = colors.HexColor("#FECACA")

ORANGE = colors.HexColor("#EA580C")
ORANGE_LIGHT = colors.HexColor("#FFF7ED")
ORANGE_BORDER = colors.HexColor("#FED7AA")

YELLOW = colors.HexColor("#CA8A04")
YELLOW_LIGHT = colors.HexColor("#FEFCE8")
YELLOW_BORDER = colors.HexColor("#FEF08A")

PURPLE = colors.HexColor("#7C3AED")

CYAN = colors.HexColor("#0891B2")


# ============================================================
# HELPERS
# ============================================================

def safe_number(
    value: Any,
    default: float = 0.0,
) -> float:
    try:
        if value is None:
            return default

        return float(value)

    except (TypeError, ValueError):
        return default


def safe_string(
    value: Any,
    default: str = "—",
) -> str:
    if value is None:
        return default

    value = str(value).strip()

    if not value:
        return default

    return value


def machine_to_dict(
    machine: Any,
) -> dict[str, Any]:
    if hasattr(machine, "model_dump"):
        return machine.model_dump()

    if hasattr(machine, "dict"):
        return machine.dict()

    if hasattr(machine, "__dict__"):
        return vars(machine)

    return {}


# ============================================================
# LIVE TELEMETRY COVERAGE
# ============================================================

def get_live_telemetry_metadata():
    """Return report-safe live telemetry coverage metadata."""

    try:
        dataframe = LiveTelemetryStore.get_all()

        if dataframe is None or dataframe.empty:
            return {
                "observations": 0,
                "latest_timestamp": None,
            }

        observations = len(dataframe)

        latest_timestamp = None

        if "timestamp" in dataframe.columns:
            try:
                latest_timestamp = dataframe["timestamp"].max()
            except Exception:
                latest_timestamp = None

        return {
            "observations": observations,
            "latest_timestamp": latest_timestamp,
        }

    except Exception:
        return {
            "observations": 0,
            "latest_timestamp": None,
        }


# ============================================================
# MACHINE VALUES
# ============================================================

def get_health(
    machine_data: dict[str, Any],
) -> float:
    return safe_number(
        machine_data.get("health_score")
    )


def get_power(
    machine_data: dict[str, Any],
) -> float:
    return safe_number(
        machine_data.get("power")
    )


def get_energy(
    machine_data: dict[str, Any],
) -> float:
    return safe_number(
        machine_data.get("energy")
    )


def get_carbon(
    machine_data: dict[str, Any],
) -> float:
    return safe_number(
        machine_data.get("carbon")
    )


def get_rul(
    machine_data: dict[str, Any],
    prediction: dict[str, Any],
):
    values = [
        machine_data.get("remaining_useful_life"),
        machine_data.get("rul"),
        prediction.get("remaining_useful_life"),
        prediction.get("rul"),
    ]

    for value in values:
        if value is None:
            continue

        try:
            return float(value)
        except (TypeError, ValueError):
            continue

    return None


# ============================================================
# RISK HELPERS
# ============================================================

def get_ai_risk(
    prediction: dict[str, Any],
) -> float | None:
    """
    Return the AI risk as a percentage only when the
    predictive backend has actually produced a prediction.

    IMPORTANT:
    An unavailable prediction is NOT a 0% risk prediction.
    It is represented as None and rendered as "—" in the PDF.
    """

    if not prediction.get("available", False):
        return None

    value = prediction.get("risk_score")

    if value is None:
        return None

    try:
        return float(value) * 100
    except (TypeError, ValueError):
        return None


def get_risk_level(
    prediction: dict[str, Any],
    risk_score: float,
) -> str:
    """
    Prefer the classification generated by the
    backend PredictiveRiskEngine.

    Thresholds are only a fallback.
    """

    if not prediction.get("available", False):
        return "UNKNOWN"

    level = safe_string(
        prediction.get("risk_level"),
        "",
    ).upper()

    if level in {
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
        "UNKNOWN",
    }:
        return level

    if risk_score is None:
        return "UNKNOWN"

    if risk_score >= 70:
        return "CRITICAL"

    if risk_score >= 40:
        return "HIGH"

    if risk_score >= 20:
        return "MEDIUM"

    return "LOW"


def risk_color(
    level: str,
):
    level = level.upper()

    if level == "CRITICAL":
        return RED

    if level == "HIGH":
        return ORANGE

    if level == "MEDIUM":
        return YELLOW

    if level == "LOW":
        return GREEN

    return TEXT_MUTED


def risk_background(
    level: str,
):
    level = level.upper()

    if level == "CRITICAL":
        return RED_LIGHT

    if level == "HIGH":
        return ORANGE_LIGHT

    if level == "MEDIUM":
        return YELLOW_LIGHT

    if level == "LOW":
        return GREEN_LIGHT

    return BACKGROUND


def risk_border(
    level: str,
):
    level = level.upper()

    if level == "CRITICAL":
        return RED_BORDER

    if level == "HIGH":
        return ORANGE_BORDER

    if level == "MEDIUM":
        return YELLOW_BORDER

    if level == "LOW":
        return GREEN_BORDER

    return BORDER


def priority_label(
    level: str,
) -> str:
    level = level.upper()

    if level == "CRITICAL":
        return "P1 · IMMEDIATE"

    if level == "HIGH":
        return "P2 · PRIORITY"

    if level == "MEDIUM":
        return "P3 · MONITOR"

    if level == "LOW":
        return "P4 · ROUTINE"

    return "PENDING"


# ============================================================
# REPORT STYLES
# ============================================================

def build_styles():
    base = getSampleStyleSheet()

    return {
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=23,
            leading=27,
            textColor=TEXT,
            alignment=TA_LEFT,
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=13,
            textColor=TEXT_SECONDARY,
        ),
        "section": ParagraphStyle(
            "ReportSection",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=TEXT,
        ),
        "label": ParagraphStyle(
            "ReportLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=GREEN,
        ),
        "body": ParagraphStyle(
            "ReportBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=13,
            textColor=TEXT_SECONDARY,
        ),
        "small": ParagraphStyle(
            "ReportSmall",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7,
            leading=10,
            textColor=TEXT_MUTED,
        ),
        "table_header": ParagraphStyle(
            "ReportTableHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=6.5,
            leading=8,
            textColor=TEXT_SECONDARY,
        ),
        "table_cell": ParagraphStyle(
            "ReportTableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=TEXT,
        ),
        "table_bold": ParagraphStyle(
            "ReportTableBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=TEXT,
        ),
    }


# ============================================================
# PAGE HEADER / FOOTER
# ============================================================

def draw_header_footer(
    canvas,
    document,
):
    canvas.saveState()

    width, height = A4

    # Top green accent
    canvas.setFillColor(GREEN)

    canvas.rect(
        0,
        height - 4 * mm,
        width,
        4 * mm,
        fill=1,
        stroke=0,
    )

    # Header
    canvas.setFillColor(TEXT)

    canvas.setFont(
        "Helvetica-Bold",
        11,
    )

    canvas.drawString(
        18 * mm,
        height - 14 * mm,
        "CarbonTwin OS",
    )

    canvas.setFont(
        "Helvetica",
        7.5,
    )

    canvas.setFillColor(
        TEXT_SECONDARY
    )

    canvas.drawRightString(
        width - 18 * mm,
        height - 14 * mm,
        "Enterprise Digital Twin Platform",
    )

    # Header divider
    canvas.setStrokeColor(BORDER)

    canvas.setLineWidth(0.5)

    canvas.line(
        18 * mm,
        height - 19 * mm,
        width - 18 * mm,
        height - 19 * mm,
    )

    # Footer divider
    canvas.line(
        18 * mm,
        15 * mm,
        width - 18 * mm,
        15 * mm,
    )

    canvas.setFont(
        "Helvetica",
        7,
    )

    canvas.setFillColor(
        TEXT_MUTED
    )

    canvas.drawString(
        18 * mm,
        10 * mm,
        "CarbonTwin OS · Factory Intelligence Report",
    )

    canvas.drawRightString(
        width - 18 * mm,
        10 * mm,
        f"Page {document.page}",
    )

    canvas.restoreState()


# ============================================================
# KPI CARD
# ============================================================

def create_kpi_card(
    label: str,
    value: str,
    description: str,
    value_color,
):
    label_style = ParagraphStyle(
        "KpiLabel",
        fontName="Helvetica-Bold",
        fontSize=6.2,
        leading=8,
        textColor=TEXT_SECONDARY,
    )

    value_style = ParagraphStyle(
        "KpiValue",
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=20,
        textColor=value_color,
    )

    description_style = ParagraphStyle(
        "KpiDescription",
        fontName="Helvetica",
        fontSize=6.2,
        leading=8,
        textColor=TEXT_MUTED,
    )

    table = Table(
        [
            [
                Paragraph(
                    label,
                    label_style,
                )
            ],
            [
                Paragraph(
                    value,
                    value_style,
                )
            ],
            [
                Paragraph(
                    description,
                    description_style,
                )
            ],
        ],
        colWidths=[
            38 * mm
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors.white,
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.6,
                    BORDER,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
            ]
        )
    )

    return table


# ============================================================
# SMALL STAT BOX
# ============================================================

def create_stat_box(
    label: str,
    value: str,
    color,
):
    value_style = ParagraphStyle(
        "StatValue",
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        textColor=color,
        alignment=TA_CENTER,
    )

    label_style = ParagraphStyle(
        "StatLabel",
        fontName="Helvetica-Bold",
        fontSize=6,
        leading=8,
        textColor=TEXT_MUTED,
        alignment=TA_CENTER,
    )

    table = Table(
        [
            [
                Paragraph(
                    value,
                    value_style,
                )
            ],
            [
                Paragraph(
                    label,
                    label_style,
                )
            ],
        ],
        colWidths=[
            29 * mm
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors.white,
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    BORDER,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    2 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    2 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2 * mm,
                ),
            ]
        )
    )

    return table


# ============================================================
# REPORT METADATA
# ============================================================

def create_metadata_table(
    report_id: str,
    generated_at: datetime,
    machine_count: int,
    observations: int,
    latest_timestamp: Any,
):
    styles = build_styles()

    rows = [
        [
            Paragraph(
                "REPORT ID",
                styles["table_header"],
            ),
            Paragraph(
                report_id,
                styles["table_cell"],
            ),
            Paragraph(
                "GENERATED",
                styles["table_header"],
            ),
            Paragraph(
                generated_at.strftime(
                    "%d %b %Y · %H:%M UTC"
                ),
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "DATA STATUS",
                styles["table_header"],
            ),
            Paragraph(
                "LIVE DIGITAL TWIN",
                styles["table_bold"],
            ),
            Paragraph(
                "ASSETS",
                styles["table_header"],
            ),
            Paragraph(
                str(machine_count),
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "AI MODEL",
                styles["table_header"],
            ),
            Paragraph(
                "CarbonTwin Predictive Failure Model",
                styles["table_cell"],
            ),
            Paragraph(
                "HORIZONS",
                styles["table_header"],
            ),
            Paragraph(
                "30m · 60m · 120m",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "TELEMETRY",
                styles["table_header"],
            ),
            Paragraph(
                f"{observations:,} live observations",
                styles["table_cell"],
            ),
            Paragraph(
                "LATEST DATA",
                styles["table_header"],
            ),
            Paragraph(
                (
                    latest_timestamp.strftime("%d %b %Y · %H:%M UTC")
                    if hasattr(latest_timestamp, "strftime")
                    else "—"
                ),
                styles["table_cell"],
            ),
        ],
    ]

    table = Table(
        rows,
        colWidths=[
            25 * mm,
            65 * mm,
            25 * mm,
            40 * mm,
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    GREEN_LIGHT,
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.6,
                    GREEN_BORDER,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.3,
                    GREEN_BORDER,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2.2 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2.2 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    return table


# ============================================================
# COLLECT FACTORY DATA
# ============================================================

def collect_factory_data():
    machines = DigitalTwinRuntime.machines()

    machine_reports = []

    total_power = 0.0
    total_energy = 0.0
    total_carbon = 0.0
    total_health = 0.0

    risk_values = []

    for machine in machines:
        machine_data = machine_to_dict(
            machine
        )

        prediction = (
            PredictiveMaintenanceService.analyze(
                machine
            )
        )

        health = get_health(
            machine_data
        )

        power = get_power(
            machine_data
        )

        energy = get_energy(
            machine_data
        )

        carbon = get_carbon(
            machine_data
        )

        risk_score = get_ai_risk(
            prediction
        )

        risk_level = get_risk_level(
            prediction,
            risk_score,
        )

        rul = get_rul(
            machine_data,
            prediction,
        )

        status = safe_string(
            machine_data.get(
                "maintenance_status"
            ),
            "Monitoring",
        )

        if prediction.get(
            "available",
            False,
        ):
            risk_values.append(
                risk_score
            )

        total_power += power
        total_energy += energy
        total_carbon += carbon
        total_health += health

        machine_reports.append(
            {
                "machine": machine,
                "data": machine_data,
                "prediction": prediction,
                "health": health,
                "power": power,
                "energy": energy,
                "carbon": carbon,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "rul": rul,
                "status": status,
            }
        )

    machine_reports.sort(
        key=lambda item: (
            item["risk_score"]
            if item["risk_score"] is not None
            else -1.0
        ),
        reverse=True,
    )

    machine_count = len(
        machine_reports
    )

    average_health = (
        total_health / machine_count
        if machine_count > 0
        else 0.0
    )

    average_risk = (
        sum(risk_values) / len(risk_values)
        if risk_values
        else None
    )

    critical_assets = [
        item
        for item in machine_reports
        if item["risk_level"] == "CRITICAL"
    ]

    high_assets = [
        item
        for item in machine_reports
        if item["risk_level"] == "HIGH"
    ]

    medium_assets = [
        item
        for item in machine_reports
        if item["risk_level"] == "MEDIUM"
    ]

    low_assets = [
        item
        for item in machine_reports
        if item["risk_level"] == "LOW"
    ]

    unknown_assets = [
        item
        for item in machine_reports
        if item["risk_level"] == "UNKNOWN"
    ]

    carbon_intensity = (
        total_carbon / total_energy
        if total_energy > 0
        else 0.0
    )

    telemetry_metadata = get_live_telemetry_metadata()

    return {
        "machines": machine_reports,
        "machine_count": machine_count,
        "observations": telemetry_metadata["observations"],
        "latest_timestamp": telemetry_metadata["latest_timestamp"],
        "average_health": average_health,
        "average_risk": average_risk,
        "critical_assets": critical_assets,
        "high_assets": high_assets,
        "medium_assets": medium_assets,
        "low_assets": low_assets,
        "unknown_assets": unknown_assets,
        "total_power": total_power,
        "total_energy": total_energy,
        "total_carbon": total_carbon,
        "carbon_intensity": carbon_intensity,
    }


# ============================================================
# MACHINE TABLE
# ============================================================

def create_machine_table(
    machine_reports,
):
    styles = build_styles()

    rows = [
        [
            Paragraph(
                "Machine",
                styles["table_header"],
            ),
            Paragraph(
                "Type",
                styles["table_header"],
            ),
            Paragraph(
                "Health",
                styles["table_header"],
            ),
            Paragraph(
                "AI Risk",
                styles["table_header"],
            ),
            Paragraph(
                "Level",
                styles["table_header"],
            ),
            Paragraph(
                "RUL",
                styles["table_header"],
            ),
            Paragraph(
                "Carbon",
                styles["table_header"],
            ),
            Paragraph(
                "Status",
                styles["table_header"],
            ),
        ]
    ]

    for item in machine_reports:
        data = item["data"]

        name = safe_string(
            data.get("name"),
            "Unknown Machine",
        )

        machine_type = safe_string(
            data.get("type"),
            "Unknown",
        )

        health = item["health"]
        risk_score = item["risk_score"]
        risk_level = item["risk_level"]
        rul = item["rul"]
        carbon = item["carbon"]
        status = item["status"]

        risk_style = ParagraphStyle(
            "RiskCell",
            parent=styles["table_bold"],
            textColor=risk_color(
                risk_level
            ),
        )

        level_style = ParagraphStyle(
            "LevelCell",
            parent=styles["table_bold"],
            textColor=risk_color(
                risk_level
            ),
        )

        status_style = ParagraphStyle(
            "StatusCell",
            parent=styles["table_cell"],
            textColor=risk_color(
                risk_level
            ),
        )

        rul_text = (
            f"{rul:.0f} cycles"
            if rul is not None
            else "—"
        )

        risk_text = (
            f"{risk_score:.1f}%"
            if risk_score is not None
            else "—"
        )

        rows.append(
            [
                Paragraph(
                    name,
                    styles["table_bold"],
                ),
                Paragraph(
                    machine_type,
                    styles["table_cell"],
                ),
                Paragraph(
                    f"{health:.1f}%",
                    styles["table_cell"],
                ),
                Paragraph(
                    risk_text,
                    risk_style,
                ),
                Paragraph(
                    risk_level,
                    level_style,
                ),
                Paragraph(
                    rul_text,
                    styles["table_cell"],
                ),
                Paragraph(
                    f"{carbon:.1f} kg",
                    styles["table_cell"],
                ),
                Paragraph(
                    status,
                    status_style,
                ),
            ]
        )

    table = Table(
        rows,
        colWidths=[
            31 * mm,
            19 * mm,
            16 * mm,
            18 * mm,
            22 * mm,
            22 * mm,
            21 * mm,
            31 * mm,
        ],
        repeatRows=1,
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    BACKGROUND,
                ),
                (
                    "LINEBELOW",
                    (0, 0),
                    (-1, 0),
                    0.7,
                    BORDER,
                ),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [
                        colors.white,
                        BACKGROUND_SOFT,
                    ],
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.25,
                    BORDER,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    1.7 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    1.7 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    return table


# ============================================================
# PRIORITY ASSET CARD
# ============================================================

def create_priority_asset_card(
    item,
):
    styles = build_styles()

    data = item["data"]
    prediction = item["prediction"]

    name = safe_string(
        data.get("name"),
        "Unknown Machine",
    )

    machine_type = safe_string(
        data.get("type"),
        "Unknown",
    )

    risk_score = item["risk_score"]
    risk_level = item["risk_level"]
    health = item["health"]

    risk_text = (
        f"{risk_score:.1f}% AI RISK"
        if risk_score is not None
        else "AI RISK PENDING"
    )
    rul = item["rul"]

    reason = safe_string(
        prediction.get("reason"),
        "Elevated predictive failure probability.",
    )

    action = safe_string(
        prediction.get("recommended_action"),
        "Continue monitoring and schedule preventive maintenance.",
    )

    rul_text = (
        f"{rul:.0f} cycles"
        if rul is not None
        else "Unavailable"
    )

    title_style = ParagraphStyle(
        "PriorityTitle",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=TEXT,
    )

    risk_style = ParagraphStyle(
        "PriorityRisk",
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=risk_color(
            risk_level
        ),
        alignment=TA_RIGHT,
    )

    meta_style = ParagraphStyle(
        "PriorityMeta",
        fontName="Helvetica",
        fontSize=7,
        leading=10,
        textColor=TEXT_SECONDARY,
    )

    action_style = ParagraphStyle(
        "PriorityAction",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=11,
        textColor=TEXT,
    )

    rows = [
        [
            Paragraph(
                name,
                title_style,
            ),
            Paragraph(
                risk_text,
                risk_style,
            ),
        ],
        [
            Paragraph(
                (
                    f"<b>Type:</b> {machine_type} "
                    f"&nbsp;&nbsp; "
                    f"<b>Health:</b> {health:.1f}% "
                    f"&nbsp;&nbsp; "
                    f"<b>RUL:</b> {rul_text}"
                ),
                meta_style,
            ),
            Paragraph(
                priority_label(risk_level),
                ParagraphStyle(
                    "PriorityLabel",
                    fontName="Helvetica-Bold",
                    fontSize=7,
                    textColor=risk_color(
                        risk_level
                    ),
                    alignment=TA_RIGHT,
                ),
            ),
        ],
        [
            Paragraph(
                f"<b>WHY</b><br/>{reason}",
                meta_style,
            ),
            Paragraph(
                f"<b>ACTION</b><br/>{action}",
                action_style,
            ),
        ],
    ]

    table = Table(
        rows,
        colWidths=[
            80 * mm,
            75 * mm,
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    risk_background(
                        risk_level
                    ),
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.7,
                    risk_border(
                        risk_level
                    ),
                ),
                (
                    "LINEBELOW",
                    (0, 1),
                    (-1, 1),
                    0.35,
                    risk_border(
                        risk_level
                    ),
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
            ]
        )
    )

    return table


# ============================================================
# PREDICTION HORIZONS
# ============================================================

def create_prediction_horizon_table(
    item,
):
    styles = build_styles()

    prediction = item["prediction"]

    if not prediction.get("available", False):
        return None

    risk_data = prediction.get("risk")

    if not isinstance(
        risk_data,
        dict,
    ):
        return None

    keys = []

    for key in [
        "30m",
        "60m",
        "120m",
    ]:
        if key in risk_data:
            keys.append(key)

    for key in risk_data:
        if key not in keys:
            keys.append(key)

    rows = [
        [
            Paragraph(
                "Horizon",
                styles["table_header"],
            ),
            Paragraph(
                "Failure Probability",
                styles["table_header"],
            ),
            Paragraph(
                "Interpretation",
                styles["table_header"],
            ),
        ]
    ]

    for key in keys:
        probability = (
            safe_number(
                risk_data.get(key)
            )
            * 100
        )

        if probability >= 70:
            interpretation = (
                "Critical near-term risk"
            )

        elif probability >= 40:
            interpretation = (
                "Elevated predictive risk"
            )

        elif probability >= 20:
            interpretation = (
                "Moderate predictive risk"
            )

        else:
            interpretation = (
                "Lower predictive risk"
            )

        rows.append(
            [
                Paragraph(
                    key,
                    styles["table_bold"],
                ),
                Paragraph(
                    f"{probability:.1f}%",
                    styles["table_bold"],
                ),
                Paragraph(
                    interpretation,
                    styles["table_cell"],
                ),
            ]
        )

    table = Table(
        rows,
        colWidths=[
            40 * mm,
            45 * mm,
            65 * mm,
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    BACKGROUND,
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.3,
                    BORDER,
                ),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [
                        colors.white,
                        BACKGROUND_SOFT,
                    ],
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
            ]
        )
    )

    return table


# ============================================================
# SUSTAINABILITY TABLE
# ============================================================

def create_sustainability_table(
    total_power: float,
    total_energy: float,
    total_carbon: float,
    carbon_intensity: float,
):
    styles = build_styles()

    rows = [
        [
            Paragraph(
                "Metric",
                styles["table_header"],
            ),
            Paragraph(
                "Current Value",
                styles["table_header"],
            ),
            Paragraph(
                "Interpretation",
                styles["table_header"],
            ),
        ],
        [
            Paragraph(
                "Power Demand",
                styles["table_bold"],
            ),
            Paragraph(
                f"{total_power:.1f} kW",
                styles["table_cell"],
            ),
            Paragraph(
                "Aggregate machine power demand.",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "Energy Consumption",
                styles["table_bold"],
            ),
            Paragraph(
                f"{total_energy:.1f} kWh",
                styles["table_cell"],
            ),
            Paragraph(
                "Aggregate machine energy usage.",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "Carbon Footprint",
                styles["table_bold"],
            ),
            Paragraph(
                f"{total_carbon:.1f} kg CO2e",
                styles["table_cell"],
            ),
            Paragraph(
                "Estimated factory carbon output.",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "Carbon Intensity",
                styles["table_bold"],
            ),
            Paragraph(
                f"{carbon_intensity:.3f} kg CO2e/kWh",
                styles["table_cell"],
            ),
            Paragraph(
                "Carbon emitted per unit of energy.",
                styles["table_cell"],
            ),
        ],
    ]

    table = Table(
        rows,
        colWidths=[
            47 * mm,
            43 * mm,
            65 * mm,
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    BACKGROUND,
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.3,
                    BORDER,
                ),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [
                        colors.white,
                        BACKGROUND_SOFT,
                    ],
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
            ]
        )
    )

    return table


# ============================================================
# RISK TABLE
# ============================================================

def create_risk_table(
    critical_count: int,
    high_count: int,
    medium_count: int,
    low_count: int,
    unknown_count: int,
):
    styles = build_styles()

    rows = [
        [
            Paragraph(
                "Level",
                styles["table_header"],
            ),
            Paragraph(
                "Assets",
                styles["table_header"],
            ),
            Paragraph(
                "Operational Meaning",
                styles["table_header"],
            ),
        ],
        [
            Paragraph(
                "CRITICAL",
                ParagraphStyle(
                    "CriticalRisk",
                    parent=styles["table_bold"],
                    textColor=RED,
                ),
            ),
            Paragraph(
                str(critical_count),
                styles["table_cell"],
            ),
            Paragraph(
                "Immediate operational review and maintenance intervention.",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "HIGH",
                ParagraphStyle(
                    "HighRisk",
                    parent=styles["table_bold"],
                    textColor=ORANGE,
                ),
            ),
            Paragraph(
                str(high_count),
                styles["table_cell"],
            ),
            Paragraph(
                "Prioritize preventive maintenance planning.",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "MEDIUM",
                ParagraphStyle(
                    "MediumRisk",
                    parent=styles["table_bold"],
                    textColor=YELLOW,
                ),
            ),
            Paragraph(
                str(medium_count),
                styles["table_cell"],
            ),
            Paragraph(
                "Continue monitoring and prepare preventive action.",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "LOW",
                ParagraphStyle(
                    "LowRisk",
                    parent=styles["table_bold"],
                    textColor=GREEN,
                ),
            ),
            Paragraph(
                str(low_count),
                styles["table_cell"],
            ),
            Paragraph(
                "Operating within lower predictive risk.",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "UNKNOWN",
                ParagraphStyle(
                    "UnknownRisk",
                    parent=styles["table_bold"],
                    textColor=TEXT_MUTED,
                ),
            ),
            Paragraph(
                str(unknown_count),
                styles["table_cell"],
            ),
            Paragraph(
                "Prediction unavailable or telemetry history is still being collected.",
                styles["table_cell"],
            ),
        ],
    ]

    table = Table(
        rows,
        colWidths=[
            35 * mm,
            25 * mm,
            90 * mm,
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    BACKGROUND,
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.3,
                    BORDER,
                ),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [
                        colors.white,
                        BACKGROUND_SOFT,
                    ],
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
            ]
        )
    )

    return table


# ============================================================
# OPERATIONAL RECOMMENDATIONS
# ============================================================

def create_operational_recommendations(
    machine_reports,
    critical_assets,
    high_assets,
    medium_assets,
    prediction_count,
):
    """Build concise, evidence-based operational recommendations."""

    styles = build_styles()

    recommendations = []

    priority_assets = critical_assets + high_assets

    for item in priority_assets[:3]:
        data = item["data"]
        prediction = item["prediction"]

        name = safe_string(
            data.get("name"),
            safe_string(data.get("id"), "Unknown asset"),
        )

        level = item["risk_level"]
        action = safe_string(
            prediction.get("recommended_action"),
            "Review machine condition and schedule preventive maintenance.",
        )

        recommendations.append(
            (
                priority_label(level),
                name,
                action,
                risk_color(level),
            )
        )

    if not recommendations and medium_assets:
        for item in medium_assets[:2]:
            data = item["data"]
            name = safe_string(
                data.get("name"),
                safe_string(data.get("id"), "Unknown asset"),
            )

            recommendations.append(
                (
                    "P3 · MONITOR",
                    name,
                    "Continue enhanced telemetry monitoring and review degradation trends.",
                    YELLOW,
                )
            )

    if not recommendations and prediction_count == 0:
        recommendations.append(
            (
                "PENDING",
                "Predictive coverage",
                "Continue collecting live telemetry until sufficient history is available for AI risk assessment.",
                TEXT_MUTED,
            )
        )

    if not recommendations:
        recommendations.append(
            (
                "P4 · ROUTINE",
                "Fleet",
                "Maintain routine predictive monitoring and review changes in machine health or operating conditions.",
                GREEN,
            )
        )

    rows = []

    for priority, name, action, color in recommendations:
        priority_style = ParagraphStyle(
            "RecommendationPriority",
            fontName="Helvetica-Bold",
            fontSize=6.5,
            leading=8,
            textColor=color,
        )

        name_style = ParagraphStyle(
            "RecommendationName",
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=TEXT,
        )

        action_style = ParagraphStyle(
            "RecommendationAction",
            fontName="Helvetica",
            fontSize=7,
            leading=10,
            textColor=TEXT_SECONDARY,
        )

        rows.append(
            [
                Paragraph(priority, priority_style),
                Paragraph(name, name_style),
                Paragraph(action, action_style),
            ]
        )

    table = Table(
        rows,
        colWidths=[
            27 * mm,
            42 * mm,
            81 * mm,
        ],
        repeatRows=0,
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "ROWBACKGROUNDS",
                    (0, 0),
                    (-1, -1),
                    [colors.white, BACKGROUND_SOFT],
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.3,
                    BORDER,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
            ]
        )
    )

    return table


# ============================================================
# AI METHODOLOGY
# ============================================================

def create_methodology_table():
    styles = build_styles()

    stages = [
        (
            "01",
            "LIVE TELEMETRY",
            "Digital Twin sensor history",
            CYAN,
        ),
        (
            "02",
            "TEMPORAL FEATURES",
            "Recent trends and degradation",
            PURPLE,
        ),
        (
            "03",
            "XGBOOST MODELS",
            "Failure probability prediction",
            GREEN,
        ),
        (
            "04",
            "RISK ENGINE",
            "Risk level and unified score",
            ORANGE,
        ),
        (
            "05",
            "ACTION",
            "Maintenance recommendation",
            RED,
        ),
    ]

    cells = []

    for number, title, description, color in stages:

        number_style = ParagraphStyle(
            f"MethodNumber{number}",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
            alignment=TA_CENTER,
        )

        title_style = ParagraphStyle(
            f"MethodTitle{number}",
            fontName="Helvetica-Bold",
            fontSize=6,
            leading=8,
            textColor=TEXT,
            alignment=TA_CENTER,
        )

        description_style = ParagraphStyle(
            f"MethodDescription{number}",
            fontName="Helvetica",
            fontSize=5.8,
            leading=7.5,
            textColor=TEXT_SECONDARY,
            alignment=TA_CENTER,
        )

        number_box = Table(
            [
                [
                    Paragraph(
                        number,
                        number_style,
                    )
                ]
            ],
            colWidths=[
                8 * mm
            ],
            rowHeights=[
                8 * mm
            ],
        )

        number_box.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, -1),
                        color,
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "MIDDLE",
                    ),
                ]
            )
        )

        cell = Table(
            [
                [number_box],
                [
                    Paragraph(
                        title,
                        title_style,
                    )
                ],
                [
                    Paragraph(
                        description,
                        description_style,
                    )
                ],
            ],
            colWidths=[
                27 * mm
            ],
        )

        cell.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, -1),
                        colors.white,
                    ),
                    (
                        "BOX",
                        (0, 0),
                        (-1, -1),
                        0.5,
                        BORDER,
                    ),
                    (
                        "LEFTPADDING",
                        (0, 0),
                        (-1, -1),
                        2 * mm,
                    ),
                    (
                        "RIGHTPADDING",
                        (0, 0),
                        (-1, -1),
                        2 * mm,
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        2 * mm,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        2 * mm,
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "MIDDLE",
                    ),
                ]
            )
        )

        cells.append(cell)

    table = Table(
        [cells],
        colWidths=[
            29 * mm,
            29 * mm,
            29 * mm,
            29 * mm,
            29 * mm,
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    1 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    1 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
            ]
        )
    )

    return table


# ============================================================
# MODEL INFORMATION TABLE
# ============================================================

def create_model_table():
    styles = build_styles()

    rows = [
        [
            Paragraph(
                "Component",
                styles["table_header"],
            ),
            Paragraph(
                "CarbonTwin Configuration",
                styles["table_header"],
            ),
        ],
        [
            Paragraph(
                "Model",
                styles["table_bold"],
            ),
            Paragraph(
                "CarbonTwin Predictive Failure Model",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "Algorithm",
                styles["table_bold"],
            ),
            Paragraph(
                "XGBoost",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "Prediction Horizons",
                styles["table_bold"],
            ),
            Paragraph(
                "30 minutes · 60 minutes · 120 minutes",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "Input",
                styles["table_bold"],
            ),
            Paragraph(
                "Live Digital Twin telemetry history with temporal features",
                styles["table_cell"],
            ),
        ],
        [
            Paragraph(
                "Output",
                styles["table_bold"],
            ),
            Paragraph(
                "Failure probability · Risk level · Risk score · Recommended action",
                styles["table_cell"],
            ),
        ],
    ]

    table = Table(
        rows,
        colWidths=[
            43 * mm,
            107 * mm,
        ],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    BACKGROUND,
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.3,
                    BORDER,
                ),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [
                        colors.white,
                        BACKGROUND_SOFT,
                    ],
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    2.5 * mm,
                ),
            ]
        )
    )

    return table


# ============================================================
# BUILD FACTORY REPORT
# ============================================================

def build_factory_report():
    factory = collect_factory_data()

    machine_reports = factory["machines"]

    machine_count = factory["machine_count"]

    observations = factory["observations"]

    latest_timestamp = factory["latest_timestamp"]

    average_health = factory["average_health"]

    average_risk = factory["average_risk"]

    critical_assets = factory["critical_assets"]

    high_assets = factory["high_assets"]

    medium_assets = factory["medium_assets"]

    low_assets = factory["low_assets"]

    unknown_assets = factory["unknown_assets"]

    total_power = factory["total_power"]

    total_energy = factory["total_energy"]

    total_carbon = factory["total_carbon"]

    carbon_intensity = factory["carbon_intensity"]

    generated_at = datetime.now(
        timezone.utc
    )

    report_id = (
        "CT-OS-FIR-"
        + generated_at.strftime(
            "%Y%m%d-%H%M"
        )
    )

    # --------------------------------------------------------
    # PDF DOCUMENT
    # --------------------------------------------------------

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=26 * mm,
        bottomMargin=19 * mm,
        title="CarbonTwin OS Factory Intelligence Report",
        author="CarbonTwin OS",
        subject=(
            "Digital Twin, Predictive AI and Sustainability"
        ),
    )

    styles = build_styles()

    story = []

    # ========================================================
    # PAGE 1
    # ========================================================

    story.append(
        Paragraph(
            "FACTORY INTELLIGENCE REPORT",
            styles["title"],
        )
    )

    story.append(
        Paragraph(
            "Predictive AI · Digital Twin · Sustainability",
            styles["label"],
        )
    )

    story.append(
        Spacer(
            1,
            2 * mm,
        )
    )

    story.append(
        Paragraph(
            (
                "Executive operational summary of factory "
                "asset health, predictive failure risk, "
                "remaining useful life and environmental "
                "performance."
            ),
            styles["subtitle"],
        )
    )

    story.append(
        Spacer(
            1,
            5 * mm,
        )
    )

    story.append(
        create_metadata_table(
            report_id,
            generated_at,
            machine_count,
            observations,
            latest_timestamp,
        )
    )

    story.append(
        Spacer(
            1,
            7 * mm,
        )
    )

    # --------------------------------------------------------
    # EXECUTIVE SUMMARY
    # --------------------------------------------------------

    story.append(
        Paragraph(
            "EXECUTIVE SUMMARY",
            styles["label"],
        )
    )

    story.append(
        Paragraph(
            "Factory Overview",
            styles["section"],
        )
    )

    average_risk_text = (
        f"{average_risk:.1f}%"
        if average_risk is not None
        else "pending"
    )

    # risk_values belongs to collect_factory_data(), so derive
    # prediction coverage from the already-collected machine reports.
    prediction_count = sum(
        1
        for item in machine_reports
        if item["prediction"].get("available", False)
    )

    if critical_assets:
        summary = (
            f"CarbonTwin OS is currently monitoring "
            f"<b>{machine_count}</b> factory assets. "
            f"The fleet has an average health score of "
            f"<b>{average_health:.1f}%</b> and an average "
            f"AI-predicted failure risk of "
            f"<b>{average_risk_text}</b>. "
            f"<b>{len(critical_assets)}</b> asset"
            f"{'s' if len(critical_assets) != 1 else ''} "
            "is classified as critical and should receive "
            "priority operational review."
        )

    elif high_assets:
        summary = (
            f"CarbonTwin OS is currently monitoring "
            f"<b>{machine_count}</b> factory assets. "
            f"The fleet has an average health score of "
            f"<b>{average_health:.1f}%</b> and an average "
            f"AI-predicted failure risk of "
            f"<b>{average_risk_text}</b>. "
            f"<b>{len(high_assets)}</b> asset"
            f"{'s' if len(high_assets) != 1 else ''} "
            "is classified as high risk and should be "
            "prioritized for preventive review."
        )

    elif prediction_count == 0:
        summary = (
            f"CarbonTwin OS is currently monitoring "
            f"<b>{machine_count}</b> factory assets with "
            f"an average health score of "
            f"<b>{average_health:.1f}%</b>. "
            "AI failure prediction is currently pending "
            "because sufficient live telemetry history is "
            "not available for the monitored assets. "
            "The report therefore does not interpret "
            "unavailable predictions as zero risk."
        )

    else:
        summary = (
            f"CarbonTwin OS is currently monitoring "
            f"<b>{machine_count}</b> factory assets. "
            f"The fleet has an average health score of "
            f"<b>{average_health:.1f}%</b> and an average "
            f"AI-predicted failure risk of "
            f"<b>{average_risk_text}</b>. "
            f"No asset is currently classified as critical. "
            f"<b>{prediction_count}</b> of {machine_count} "
            "assets currently have an available AI prediction."
        )

    story.append(
        Paragraph(
            summary,
            styles["body"],
        )
    )

    story.append(
        Spacer(
            1,
            5 * mm,
        )
    )

    # --------------------------------------------------------
    # KPI CARDS
    # --------------------------------------------------------

    kpi_table = Table(
        [
            [
                create_kpi_card(
                    "MONITORED ASSETS",
                    str(machine_count),
                    "Digital twin assets",
                    TEXT,
                ),
                create_kpi_card(
                    "AVERAGE HEALTH",
                    f"{average_health:.1f}%",
                    "Fleet health score",
                    GREEN,
                ),
                create_kpi_card(
                    "CRITICAL RISK",
                    str(
                        len(critical_assets)
                    ),
                    "Assets classified critical",
                    RED,
                ),
                create_kpi_card(
                    "AI COVERAGE",
                    (
                        f"{prediction_count}/{machine_count}"
                        if machine_count > 0
                        else "0/0"
                    ),
                    "Assets with live AI prediction",
                    PURPLE,
                ),
            ]
        ],
        colWidths=[
            41 * mm,
            41 * mm,
            41 * mm,
            41 * mm,
        ],
    )

    kpi_table.setStyle(
        TableStyle(
            [
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    1.5 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    1.5 * mm,
                ),
            ]
        )
    )

    story.append(
        kpi_table
    )

    story.append(
        Spacer(
            1,
            7 * mm,
        )
    )

    # --------------------------------------------------------
    # RISK DISTRIBUTION
    # --------------------------------------------------------

    story.append(
        Paragraph(
            "CURRENT RISK DISTRIBUTION",
            styles["label"],
        )
    )

    risk_distribution = Table(
        [
            [
                create_stat_box(
                    "CRITICAL",
                    str(
                        len(critical_assets)
                    ),
                    RED,
                ),
                create_stat_box(
                    "HIGH",
                    str(
                        len(high_assets)
                    ),
                    ORANGE,
                ),
                create_stat_box(
                    "MEDIUM",
                    str(
                        len(medium_assets)
                    ),
                    YELLOW,
                ),
                create_stat_box(
                    "LOW",
                    str(
                        len(low_assets)
                    ),
                    GREEN,
                ),
                create_stat_box(
                    "UNKNOWN",
                    str(
                        len(unknown_assets)
                    ),
                    TEXT_MUTED,
                ),
            ]
        ],
        colWidths=[
            31 * mm,
            31 * mm,
            31 * mm,
            31 * mm,
            31 * mm,
        ],
    )

    risk_distribution.setStyle(
        TableStyle(
            [
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    1.5 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    1.5 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
            ]
        )
    )

    story.append(
        risk_distribution
    )

    story.append(
        Spacer(
            1,
            7 * mm,
        )
    )

    # --------------------------------------------------------
    # ASSET TABLE
    # --------------------------------------------------------

    story.append(
        Paragraph(
            "ASSET INTELLIGENCE",
            styles["label"],
        )
    )

    story.append(
        Paragraph(
            "Machine Intelligence",
            styles["section"],
        )
    )

    story.append(
        Paragraph(
            (
                "Assets are ranked by the unified AI risk "
                "assessment returned by the CarbonTwin "
                "predictive maintenance engine."
            ),
            styles["body"],
        )
    )

    story.append(
        Spacer(
            1,
            3 * mm,
        )
    )

    story.append(
        create_machine_table(
            machine_reports
        )
    )

    # ========================================================
    # PAGE 2
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "PREDICTIVE AI",
            styles["label"],
        )
    )

    story.append(
        Paragraph(
            "Predictive Maintenance Intelligence",
            styles["section"],
        )
    )

    story.append(
        Paragraph(
            (
                "CarbonTwin evaluates live Digital Twin "
                "telemetry and produces forward-looking "
                "machine failure probabilities. The unified "
                "risk score represents the highest predictive "
                "probability across the configured future "
                "horizons."
            ),
            styles["body"],
        )
    )

    story.append(
        Spacer(
            1,
            6 * mm,
        )
    )

    # --------------------------------------------------------
    # PRIORITY ASSETS
    # --------------------------------------------------------

    story.append(
        Paragraph(
            "PRIORITY ASSETS",
            styles["label"],
        )
    )

    story.append(
        Paragraph(
            "Maintenance Decision Queue",
            styles["section"],
        )
    )

    priority_assets = (
        critical_assets
        + high_assets
    )

    if priority_assets:

        for item in priority_assets[:3]:

            block = [
                create_priority_asset_card(
                    item
                ),
                Spacer(
                    1,
                    3 * mm,
                ),
            ]

            horizon_table = (
                create_prediction_horizon_table(
                    item
                )
            )

            if horizon_table is not None:

                block.extend(
                    [
                        Paragraph(
                            "PREDICTION HORIZONS",
                            styles["label"],
                        ),
                        horizon_table,
                        Spacer(
                            1,
                            5 * mm,
                        ),
                    ]
                )

            story.append(
                KeepTogether(
                    block
                )
            )

    else:

        if prediction_count == 0:
            priority_message = (
                "No predictive-maintenance queue is available yet. "
                "The AI engine is waiting for sufficient live telemetry "
                "history before assigning machine-level failure risk."
            )
        else:
            priority_message = (
                "No critical or high-risk assets are currently present "
                "in the predictive maintenance queue."
            )

        story.append(
            Paragraph(
                priority_message,
                styles["body"],
            )
        )

    # ========================================================
    # PAGE 3
    # ========================================================

    story.append(
        PageBreak()
    )

    # --------------------------------------------------------
    # RISK INTERPRETATION
    # --------------------------------------------------------

    risk_section = [
        Paragraph(
            "RISK INTERPRETATION",
            styles["label"],
        ),
        Paragraph(
            "Operational Risk Levels",
            styles["section"],
        ),
        create_risk_table(
            len(critical_assets),
            len(high_assets),
            len(medium_assets),
            len(low_assets),
            len(unknown_assets),
        ),
        Spacer(
            1,
            2 * mm,
        ),
        Paragraph(
            (
                f"AI prediction coverage: <b>{prediction_count}</b> "
                f"of <b>{machine_count}</b> monitored assets. "
                "UNKNOWN indicates that a valid predictive result "
                "was not available at report generation time."
            ),
            styles["small"],
        ),
    ]

    story.append(
        KeepTogether(risk_section)
    )

    story.append(
        Spacer(
            1,
            6 * mm,
        )
    )

    # --------------------------------------------------------
    # SUSTAINABILITY
    # --------------------------------------------------------

    sustainability_section = [
        Paragraph(
            "SUSTAINABILITY",
            styles["label"],
        ),
        Paragraph(
            "Environmental Performance",
            styles["section"],
        ),
        Paragraph(
            (
                "Environmental indicators are aggregated "
                "from the current factory machine state and "
                "presented alongside operational intelligence "
                "to support energy and carbon-aware decisions."
            ),
            styles["body"],
        ),
        Spacer(
            1,
            4 * mm,
        ),
        create_sustainability_table(
            total_power,
            total_energy,
            total_carbon,
            carbon_intensity,
        ),
    ]

    story.append(
        KeepTogether(sustainability_section)
    )

    story.append(
        Spacer(
            1,
            6 * mm,
        )
    )

    # --------------------------------------------------------
    # OPERATIONAL RECOMMENDATIONS
    # --------------------------------------------------------

    story.append(
        Paragraph(
            "OPERATIONS",
            styles["label"],
        )
    )

    story.append(
        Paragraph(
            "Recommended Actions",
            styles["section"],
        )
    )

    story.append(
        Paragraph(
            (
                "Evidence-based actions generated from the "
                "current predictive-maintenance state. "
                "Recommendations are advisory and should be "
                "validated against plant operating procedures."
            ),
            styles["body"],
        )
    )

    story.append(
        Spacer(
            1,
            3 * mm,
        )
    )

    story.append(
        create_operational_recommendations(
            machine_reports,
            critical_assets,
            high_assets,
            medium_assets,
            prediction_count,
        )
    )

    # ========================================================
    # PAGE 4
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "AI SYSTEM",
            styles["label"],
        )
    )

    story.append(
        Paragraph(
            "How CarbonTwin Predicts Failure",
            styles["section"],
        )
    )

    story.append(
        Paragraph(
            (
                "CarbonTwin OS combines live Digital Twin "
                "telemetry, temporal feature engineering and "
                "trained XGBoost prediction models to estimate "
                "future machine failure risk. The predictive "
                "risk engine converts those probabilities into "
                "operational risk levels and recommended actions."
            ),
            styles["body"],
        )
    )

    story.append(
        Spacer(
            1,
            6 * mm,
        )
    )

    story.append(
        create_methodology_table()
    )

    story.append(
        Spacer(
            1,
            8 * mm,
        )
    )

    # --------------------------------------------------------
    # MODEL INFORMATION
    # --------------------------------------------------------

    story.append(
        Paragraph(
            "MODEL INFORMATION",
            styles["label"],
        )
    )

    story.append(
        Paragraph(
            "Predictive AI Configuration",
            styles["section"],
        )
    )

    story.append(
        create_model_table()
    )

    story.append(
        Spacer(
            1,
            8 * mm,
        )
    )

    # --------------------------------------------------------
    # EXECUTIVE CONCLUSION
    # --------------------------------------------------------

    story.append(
        Paragraph(
            "EXECUTIVE CONCLUSION",
            styles["label"],
        )
    )

    story.append(
        Paragraph(
            "Operational Intelligence",
            styles["section"],
        )
    )

    if critical_assets:

        conclusion = (
            f"The current factory state contains "
            f"<b>{len(critical_assets)}</b> critical asset"
            f"{'s' if len(critical_assets) != 1 else ''} "
            "requiring priority operational review. "
            f"There {'is' if len(high_assets) == 1 else 'are'} also "
            f"<b>{len(high_assets)}</b> high-risk asset"
            f"{'' if len(high_assets) == 1 else 's'} that should be "
            "incorporated "
            "into preventive maintenance planning."
        )

    elif high_assets:

        conclusion = (
            "The factory currently has no critical assets, "
            f"but <b>{len(high_assets)}</b> asset"
            f"{'s' if len(high_assets) != 1 else ''} "
            "are classified as high risk. Preventive "
            "maintenance planning should prioritize these "
            "assets while the remaining fleet continues "
            "under predictive monitoring."
        )

    elif prediction_count == 0:

        conclusion = (
            "The monitored fleet currently has no available "
            "AI risk classifications because the predictive "
            "engine is still collecting sufficient live "
            "telemetry history. This report intentionally "
            "does not treat unavailable predictions as zero "
            "risk. CarbonTwin OS should continue monitoring "
            "the Digital Twin until prediction coverage is "
            "established."
        )

    else:

        conclusion = (
            "The monitored fleet currently contains no "
            "critical or high-risk assets. CarbonTwin OS "
            "should continue monitoring live telemetry "
            "and machine degradation indicators for changes."
        )

    conclusion_with_coverage = (
        conclusion
        + " "
        + (
            f"The report is based on <b>{observations:,}</b> live "
            "Digital Twin telemetry observations."
            if observations > 0
            else
            "Live telemetry coverage was unavailable at report generation time."
        )
    )

    story.append(
        Paragraph(
            conclusion_with_coverage,
            styles["body"],
        )
    )

    story.append(
        Spacer(
            1,
            7 * mm,
        )
    )

    # --------------------------------------------------------
    # FINAL DECISION METRICS
    # --------------------------------------------------------

    final_metrics = Table(
        [
            [
                create_stat_box(
                    "CRITICAL",
                    str(
                        len(critical_assets)
                    ),
                    RED,
                ),
                create_stat_box(
                    "HIGH",
                    str(
                        len(high_assets)
                    ),
                    ORANGE,
                ),
                create_stat_box(
                    "AVG HEALTH",
                    f"{average_health:.1f}%",
                    GREEN,
                ),
                create_stat_box(
                    "AVG AI RISK",
                    (
                        f"{average_risk:.1f}%"
                        if average_risk is not None
                        else "—"
                    ),
                    PURPLE,
                ),
            ]
        ],
        colWidths=[
            39 * mm,
            39 * mm,
            39 * mm,
            39 * mm,
        ],
    )

    final_metrics.setStyle(
        TableStyle(
            [
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    1.5 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    1.5 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
            ]
        )
    )

    story.append(
        final_metrics
    )

    story.append(
        Spacer(
            1,
            8 * mm,
        )
    )

    # --------------------------------------------------------
    # BRANDING BLOCK
    # --------------------------------------------------------

    brand_title = ParagraphStyle(
        "BrandTitle",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=GREEN,
    )

    brand_body = ParagraphStyle(
        "BrandBody",
        fontName="Helvetica",
        fontSize=6.8,
        leading=9,
        textColor=TEXT_SECONDARY,
        alignment=TA_RIGHT,
    )

    branding = Table(
        [
            [
                Paragraph(
                    "CarbonTwin OS",
                    brand_title,
                ),
                Paragraph(
                    (
                        "Enterprise Digital Twin Platform<br/>"
                        "Predictive AI · Digital Twin · Sustainability"
                    ),
                    brand_body,
                ),
            ]
        ],
        colWidths=[
            70 * mm,
            80 * mm,
        ],
    )

    branding.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    GREEN_LIGHT,
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.6,
                    GREEN_BORDER,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    story.append(
        branding
    )

    # --------------------------------------------------------
    # BUILD PDF
    # --------------------------------------------------------

    document.build(
        story,
        onFirstPage=draw_header_footer,
        onLaterPages=draw_header_footer,
    )

    buffer.seek(0)

    return buffer


# ============================================================
# DOWNLOAD ENDPOINT
# ============================================================

@router.get(
    "/factory/pdf"
)
def download_factory_report():

    pdf_buffer = build_factory_report()

    filename = (
        "CarbonTwin-OS-Factory-"
        "Intelligence-Report.pdf"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )