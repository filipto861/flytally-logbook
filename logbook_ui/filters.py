from __future__ import annotations

import pandas as pd
import streamlit as st

from logbook_core.config import EVIDENCE_OPTIONS

def apply_filters(df: pd.DataFrame, key_prefix: str = "") -> pd.DataFrame:
    if df.empty:
        return df
    work = df.copy()
    years = sorted(int(y) for y in work["year"].dropna().unique())
    registrations = sorted(r for r in work["registration"].dropna().unique() if r)
    roles = sorted(r for r in work["role"].dropna().unique() if r)

    with st.expander("Filtry", expanded=False):
        f1, f2, f3, f4 = st.columns(4)
        with f1:
            selected_years = st.multiselect("Rok", years, default=years, key=f"{key_prefix}_years")
        with f2:
            selected_evidence = st.multiselect("Evidence", EVIDENCE_OPTIONS, default=EVIDENCE_OPTIONS, key=f"{key_prefix}_ev")
        with f3:
            selected_roles = st.multiselect("Funkce", roles, default=roles, key=f"{key_prefix}_roles")
        with f4:
            selected_regs = st.multiselect("Imatrikulace", registrations, default=[], key=f"{key_prefix}_regs")

    if selected_years:
        work = work[work["year"].isin(selected_years)]
    if selected_evidence:
        work = work[work["evidence"].isin(selected_evidence)]
    if selected_roles:
        work = work[work["role"].isin(selected_roles)]
    if selected_regs:
        work = work[work["registration"].isin(selected_regs)]
    return work

