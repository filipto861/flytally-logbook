from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

import pandas as pd

from .metrics import parse_time_to_minutes

VALID_EVIDENCE = {"ULL", "EASA"}
VALID_ROLES = {"PIC", "DUAL", "INSTRUKTOR", "SAFETY PILOT", "CO-PILOT", "PAX", "OBSERVER"}
SAFE_PROFILE_FIELDS = ("evidence", "aircraft_type", "aircraft_class", "role")


def _text(value: Any) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "nat", "<na>"} else text


def _upper(value: Any) -> str:
    return _text(value).upper()


def _int(value: Any, default: int = 0) -> int:
    try:
        if value is None or pd.isna(value):
            return default
        return int(float(value))
    except Exception:
        return default


def _float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def _delta_minutes(start: Any, end: Any) -> int | None:
    a = parse_time_to_minutes(start)
    b = parse_time_to_minutes(end)
    if a is None or b is None:
        return None
    return (b - a) % 1440


def _issue(
    *,
    flight_id: int | None,
    severity: str,
    category: str,
    code: str,
    title: str,
    detail: str,
    row: dict[str, Any] | None = None,
    patch: dict[str, Any] | None = None,
    patch_kind: str | None = None,
) -> dict[str, Any]:
    row = row or {}
    return {
        "flight_id": int(flight_id) if flight_id else None,
        "severity": severity,
        "category": category,
        "code": code,
        "title": title,
        "detail": detail,
        "date": _text(row.get("date")),
        "registration": _upper(row.get("registration")),
        "departure": _upper(row.get("departure")),
        "arrival": _upper(row.get("arrival")),
        "suggested_patch": dict(patch or {}),
        "patch_kind": patch_kind,
    }


def _aircraft_map(aircraft: pd.DataFrame) -> dict[str, dict[str, Any]]:
    if aircraft is None or aircraft.empty or "registration" not in aircraft.columns:
        return {}
    result: dict[str, dict[str, Any]] = {}
    for _, row in aircraft.iterrows():
        reg = _upper(row.get("registration"))
        if reg:
            result[reg] = row.to_dict()
    return result


def _track_rows_by_flight(tracks: pd.DataFrame) -> dict[int, list[dict[str, Any]]]:
    result: dict[int, list[dict[str, Any]]] = defaultdict(list)
    if tracks is None or tracks.empty or "flight_id" not in tracks.columns:
        return result
    for _, row in tracks.iterrows():
        try:
            flight_id = int(row.get("flight_id"))
        except Exception:
            continue
        result[flight_id].append(row.to_dict())
    return result


def _flight_time_key(row: dict[str, Any]) -> int | None:
    for field in ("off_block", "takeoff", "landing", "on_block"):
        value = parse_time_to_minutes(row.get(field))
        if value is not None:
            return value
    return None


def _exact_duplicate_signature(row: dict[str, Any]) -> tuple[str, ...] | None:
    date_value = _text(row.get("date"))
    reg = _upper(row.get("registration"))
    if not date_value or not reg:
        return None
    times = tuple(_text(row.get(field)) for field in ("off_block", "takeoff", "landing", "on_block"))
    if not any(times):
        return None
    return (
        date_value,
        reg,
        _upper(row.get("departure")),
        _upper(row.get("arrival")),
        *times,
    )


def _route_signature(row: dict[str, Any]) -> tuple[str, ...] | None:
    date_value = _text(row.get("date"))
    reg = _upper(row.get("registration"))
    if not date_value or not reg:
        return None
    return (
        date_value,
        reg,
        _upper(row.get("departure")),
        _upper(row.get("arrival")),
    )


def scan_data_quality(
    flights: pd.DataFrame,
    aircraft: pd.DataFrame,
    *,
    known_airports: Iterable[str] = (),
    tracks: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """Scan one user's logbook without mutating any data.

    The engine returns findings plus a separate collection of *safe* patches.
    Safe patches only fill currently empty flight fields from the matching
    aircraft profile. Mismatches and GPS-derived suggestions are never silently
    included in the bulk patch set.
    """
    known = {_upper(value) for value in known_airports if _upper(value)}
    profiles = _aircraft_map(aircraft)
    track_map = _track_rows_by_flight(tracks if tracks is not None else pd.DataFrame())

    if flights is None or flights.empty:
        return {
            "status": "ok",
            "issues": [],
            "safe_patches": {},
            "counts": {"problem": 0, "warning": 0, "flights": 0, "safe_repairs": 0},
            "categories": {},
        }

    rows: list[dict[str, Any]] = []
    for _, series in flights.iterrows():
        row = series.to_dict()
        try:
            row["id"] = int(row.get("id"))
        except Exception:
            continue
        rows.append(row)

    issues: list[dict[str, Any]] = []
    safe_patches: dict[int, dict[str, Any]] = defaultdict(dict)

    # ------------------------------------------------------------------
    # Per-flight structural and profile checks.
    # ------------------------------------------------------------------
    for row in rows:
        flight_id = int(row["id"])
        registration = _upper(row.get("registration"))
        evidence = _upper(row.get("evidence"))
        role = _upper(row.get("role"))
        aircraft_class = _upper(row.get("aircraft_class"))
        aircraft_type = _text(row.get("aircraft_type"))
        departure = _upper(row.get("departure"))
        arrival = _upper(row.get("arrival"))

        if not _text(row.get("date")):
            issues.append(_issue(
                flight_id=flight_id, severity="problem", category="Základní údaje",
                code="missing_date", title="Chybí datum letu",
                detail="Bez data nelze let správně řadit ani zahrnout do časových statistik.",
                row=row,
            ))
        if not registration:
            issues.append(_issue(
                flight_id=flight_id, severity="problem", category="Základní údaje",
                code="missing_registration", title="Chybí imatrikulace",
                detail="Let není přiřazen k žádnému letadlu.",
                row=row,
            ))
        if not evidence:
            issues.append(_issue(
                flight_id=flight_id, severity="warning", category="Základní údaje",
                code="missing_evidence", title="Chybí evidence ULL / EASA",
                detail="Součty ULL a EASA mohou být neúplné.",
                row=row,
            ))
        elif evidence not in VALID_EVIDENCE:
            issues.append(_issue(
                flight_id=flight_id, severity="problem", category="Základní údaje",
                code="invalid_evidence", title="Neplatná evidence",
                detail=f"Hodnota „{evidence}“ není ULL ani EASA.",
                row=row,
            ))
        if not role:
            issues.append(_issue(
                flight_id=flight_id, severity="warning", category="Základní údaje",
                code="missing_role", title="Chybí funkce pilota",
                detail="PIC / DUAL a další součty mohou být neúplné.",
                row=row,
            ))
        elif role not in VALID_ROLES:
            issues.append(_issue(
                flight_id=flight_id, severity="problem", category="Základní údaje",
                code="invalid_role", title="Neplatná funkce pilota",
                detail=f"Hodnota „{role}“ není podporovaná funkce.",
                row=row,
            ))
        if not aircraft_class:
            issues.append(_issue(
                flight_id=flight_id, severity="warning", category="Základní údaje",
                code="missing_aircraft_class", title="Chybí třída letadla",
                detail="Třída je důležitá pro přesnější statistiky a budoucí recency pravidla.",
                row=row,
            ))
        if not departure:
            issues.append(_issue(
                flight_id=flight_id, severity="warning", category="Letiště",
                code="missing_departure", title="Chybí letiště odletu",
                detail="Pokud má let GPS track, Logbook může nabídnout návrh podle prvního bodu.",
                row=row,
            ))
        elif known and departure not in known:
            issues.append(_issue(
                flight_id=flight_id, severity="warning", category="Letiště",
                code="unknown_departure", title=f"Neznámé letiště {departure}",
                detail="Kód není v globální databázi ani mezi vlastními plochami se souřadnicemi.",
                row=row,
            ))
        if not arrival:
            issues.append(_issue(
                flight_id=flight_id, severity="warning", category="Letiště",
                code="missing_arrival", title="Chybí letiště příletu",
                detail="Pokud má let GPS track, Logbook může nabídnout návrh podle posledního bodu.",
                row=row,
            ))
        elif known and arrival not in known:
            issues.append(_issue(
                flight_id=flight_id, severity="warning", category="Letiště",
                code="unknown_arrival", title=f"Neznámé letiště {arrival}",
                detail="Kód není v globální databázi ani mezi vlastními plochami se souřadnicemi.",
                row=row,
            ))

        # Aircraft profile consistency and safe fill suggestions.
        if registration:
            profile = profiles.get(registration)
            if not profile:
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="Letadlo",
                    code="aircraft_without_profile", title=f"{registration} nemá profil letadla",
                    detail="Let zůstává platný, ale nemůže využít profilové předvolby a kontrolu konzistence.",
                    row=row,
                ))
            else:
                profile_evidence = _upper(profile.get("evidence"))
                profile_class = _upper(profile.get("aircraft_class"))
                profile_type = _text(profile.get("aircraft_type"))
                profile_role = _upper(profile.get("default_role"))

                patch: dict[str, Any] = {}
                if not evidence and profile_evidence:
                    patch["evidence"] = profile_evidence
                if not aircraft_class and profile_class:
                    patch["aircraft_class"] = profile_class
                if not aircraft_type and profile_type:
                    patch["aircraft_type"] = profile_type
                if not role and profile_role:
                    patch["role"] = profile_role
                if patch:
                    safe_patches[flight_id].update(patch)

                if evidence and profile_evidence and evidence != profile_evidence:
                    issues.append(_issue(
                        flight_id=flight_id, severity="warning", category="Letadlo",
                        code="evidence_profile_mismatch",
                        title=f"Evidence nesedí s profilem {registration}",
                        detail=f"Let má {evidence}, profil letadla má {profile_evidence}. Historický záznam se proto neopravuje automaticky.",
                        row=row,
                    ))
                if aircraft_class and profile_class and aircraft_class != profile_class:
                    issues.append(_issue(
                        flight_id=flight_id, severity="warning", category="Letadlo",
                        code="class_profile_mismatch",
                        title=f"Třída nesedí s profilem {registration}",
                        detail=f"Let má {aircraft_class}, profil letadla má {profile_class}.",
                        row=row,
                    ))
                if aircraft_type and profile_type and aircraft_type.casefold() != profile_type.casefold():
                    issues.append(_issue(
                        flight_id=flight_id, severity="warning", category="Letadlo",
                        code="type_profile_mismatch",
                        title=f"Typ nesedí s profilem {registration}",
                        detail=f"Let má „{aircraft_type}“, profil má „{profile_type}“.",
                        row=row,
                    ))

        # Time format and plausibility.
        time_values = {
            "Off Block": row.get("off_block"),
            "Takeoff": row.get("takeoff"),
            "Landing": row.get("landing"),
            "On Block": row.get("on_block"),
        }
        invalid_labels = [
            label for label, value in time_values.items()
            if _text(value) and parse_time_to_minutes(value) is None
        ]
        if invalid_labels:
            issues.append(_issue(
                flight_id=flight_id, severity="problem", category="Časy",
                code="invalid_time_format", title="Neplatný formát času",
                detail="Nelze přečíst: " + ", ".join(invalid_labels) + ".",
                row=row,
            ))
        else:
            off = row.get("off_block")
            takeoff = row.get("takeoff")
            landing = row.get("landing")
            on = row.get("on_block")
            block = _delta_minutes(off, on)
            air = _delta_minutes(takeoff, landing)
            taxi_out = _delta_minutes(off, takeoff)
            taxi_in = _delta_minutes(landing, on)

            if _text(off) and not _text(on):
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="Časy",
                    code="missing_on_block", title="Chybí On Block",
                    detail="Block Time nelze spočítat.", row=row,
                ))
            if _text(on) and not _text(off):
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="Časy",
                    code="missing_off_block", title="Chybí Off Block",
                    detail="Block Time nelze spočítat.", row=row,
                ))
            if _text(takeoff) and not _text(landing):
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="Časy",
                    code="missing_landing", title="Chybí Landing",
                    detail="Air Time nelze spočítat.", row=row,
                ))
            if _text(landing) and not _text(takeoff):
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="Časy",
                    code="missing_takeoff", title="Chybí Takeoff",
                    detail="Air Time nelze spočítat.", row=row,
                ))

            if block is not None and block > 18 * 60:
                issues.append(_issue(
                    flight_id=flight_id, severity="problem", category="Časy",
                    code="extreme_block_time", title="Podezřele dlouhý Block Time",
                    detail=f"Vypočtený Block Time je {block // 60}:{block % 60:02d}.",
                    row=row,
                ))
            elif block is not None and block > 12 * 60:
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="Časy",
                    code="long_block_time", title="Velmi dlouhý Block Time",
                    detail=f"Vypočtený Block Time je {block // 60}:{block % 60:02d}. Zkontroluj případný přechod přes půlnoc.",
                    row=row,
                ))
            if air is not None and air > 12 * 60:
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="Časy",
                    code="long_air_time", title="Velmi dlouhý Air Time",
                    detail=f"Vypočtený Air Time je {air // 60}:{air % 60:02d}.",
                    row=row,
                ))
            if block is not None and air is not None and air > block + 5:
                issues.append(_issue(
                    flight_id=flight_id, severity="problem", category="Časy",
                    code="air_exceeds_block", title="Air Time je delší než Block Time",
                    detail=f"Air {air // 60}:{air % 60:02d} vs. Block {block // 60}:{block % 60:02d}.",
                    row=row,
                ))
            if taxi_out is not None and all(_text(row.get(x)) for x in ("off_block", "takeoff")) and taxi_out > 180:
                issues.append(_issue(
                    flight_id=flight_id, severity="problem", category="Časy",
                    code="taxi_out_implausible", title="Podezřelé pořadí Off Block / Takeoff",
                    detail=f"Rozdíl je {taxi_out} minut. Může jít o přehozený čas nebo chybný přechod přes půlnoc.",
                    row=row,
                ))
            if taxi_in is not None and all(_text(row.get(x)) for x in ("landing", "on_block")) and taxi_in > 180:
                issues.append(_issue(
                    flight_id=flight_id, severity="problem", category="Časy",
                    code="taxi_in_implausible", title="Podezřelé pořadí Landing / On Block",
                    detail=f"Rozdíl je {taxi_in} minut.",
                    row=row,
                ))
            if block is not None and 0 < block < 3 and _int(row.get("starts"), 0) > 0:
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="Časy",
                    code="very_short_block", title="Velmi krátký let",
                    detail=f"Block Time je jen {block} minuty. Zkontroluj, zda jsou časy správně.",
                    row=row,
                ))

        # GPS metadata quality.
        flight_tracks = track_map.get(flight_id, [])
        for track in flight_tracks:
            track_id = _int(track.get("id"), 0)
            point_count = _int(track.get("point_count"), 0)
            distance = _float(track.get("distance_km"), 0.0)
            if point_count < 2:
                issues.append(_issue(
                    flight_id=flight_id, severity="problem", category="GPS",
                    code="track_too_short", title="GPS track nemá dostatek bodů",
                    detail=f"Track ID {track_id} obsahuje {point_count} bodů.",
                    row=row,
                ))
            elif distance <= 0.05:
                issues.append(_issue(
                    flight_id=flight_id, severity="warning", category="GPS",
                    code="track_zero_distance", title="GPS track má nulovou vzdálenost",
                    detail=f"Track ID {track_id} má {point_count} bodů, ale vzdálenost je pouze {distance:.2f} km.",
                    row=row,
                ))

    # ------------------------------------------------------------------
    # Duplicate detection. Exact duplicates are problems; near duplicates
    # (same date/aircraft/route, <=10 minutes apart) are warnings.
    # ------------------------------------------------------------------
    exact_groups: dict[tuple[str, ...], list[dict[str, Any]]] = defaultdict(list)
    route_groups: dict[tuple[str, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        exact = _exact_duplicate_signature(row)
        if exact is not None:
            exact_groups[exact].append(row)
        route = _route_signature(row)
        if route is not None:
            route_groups[route].append(row)

    exact_pairs: set[tuple[int, int]] = set()
    for group in exact_groups.values():
        if len(group) < 2:
            continue
        ordered = sorted(group, key=lambda row: int(row["id"]))
        original = ordered[0]
        for duplicate in ordered[1:]:
            pair = (int(original["id"]), int(duplicate["id"]))
            exact_pairs.add(pair)
            issues.append(_issue(
                flight_id=int(duplicate["id"]),
                severity="problem",
                category="Duplicity",
                code="exact_duplicate",
                title="Pravděpodobně duplicitní let",
                detail=f"Záznam je shodný s letem ID {int(original['id'])}. Smazání zůstává vždy ruční po kontrole detailu.",
                row=duplicate,
            ))

    near_seen: set[tuple[int, int]] = set()
    for group in route_groups.values():
        if len(group) < 2:
            continue
        timed = [
            (row, _flight_time_key(row))
            for row in group
        ]
        timed = [(row, minute) for row, minute in timed if minute is not None]
        timed.sort(key=lambda item: (int(item[1]), int(item[0]["id"])))
        for (left, left_min), (right, right_min) in zip(timed, timed[1:]):
            left_id = int(left["id"])
            right_id = int(right["id"])
            pair = (min(left_id, right_id), max(left_id, right_id))
            if pair in exact_pairs or pair in near_seen:
                continue
            delta = abs(int(right_min) - int(left_min))
            delta = min(delta, 1440 - delta)
            if delta <= 10:
                near_seen.add(pair)
                issues.append(_issue(
                    flight_id=right_id,
                    severity="warning",
                    category="Duplicity",
                    code="near_duplicate",
                    title="Možná duplicita",
                    detail=f"Stejné datum, letadlo a trasa jako ID {left_id}; první zaznamenaný čas se liší jen o {delta} min.",
                    row=right,
                ))

    # Orphan/cross-reference detection for track metadata supplied by DB.
    known_flight_ids = {int(row["id"]) for row in rows}
    if tracks is not None and not tracks.empty:
        for _, track in tracks.iterrows():
            flight_id = _int(track.get("flight_id"), 0)
            if flight_id and flight_id not in known_flight_ids:
                issues.append(_issue(
                    flight_id=None,
                    severity="problem",
                    category="GPS",
                    code="orphan_track",
                    title="GPS track odkazuje na chybějící let",
                    detail=f"Track ID {_int(track.get('id'), 0)} odkazuje na flight_id {flight_id}.",
                ))

    severity_rank = {"problem": 0, "warning": 1}
    issues.sort(
        key=lambda item: (
            severity_rank.get(item["severity"], 9),
            item.get("category", ""),
            item.get("date", ""),
            int(item.get("flight_id") or 0),
            item.get("code", ""),
        )
    )

    problem_count = sum(1 for issue in issues if issue["severity"] == "problem")
    warning_count = sum(1 for issue in issues if issue["severity"] == "warning")
    affected_flights = {
        int(issue["flight_id"])
        for issue in issues
        if issue.get("flight_id")
    }
    category_counts: dict[str, int] = defaultdict(int)
    for issue in issues:
        category_counts[str(issue["category"])] += 1

    status = "problem" if problem_count else ("warning" if warning_count else "ok")
    safe = {
        int(flight_id): dict(patch)
        for flight_id, patch in safe_patches.items()
        if patch
    }
    return {
        "status": status,
        "issues": issues,
        "safe_patches": safe,
        "counts": {
            "problem": problem_count,
            "warning": warning_count,
            "flights": len(affected_flights),
            "safe_repairs": len(safe),
        },
        "categories": dict(sorted(category_counts.items())),
    }
