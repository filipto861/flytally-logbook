from __future__ import annotations

import streamlit as st

from logbook_core.config import APP_VERSION

def apply_ui_theme(dark_mode: bool) -> None:
    if dark_mode:
        bg = "#06101d"; panel = "#0b182a"; panel2 = "#10233a"; text = "#e6f0fb"; muted = "#92a8c0"; border = "rgba(125,211,252,.18)"; accent = "#38bdf8"; good = "#22c55e"; warn = "#f59e0b"; shadow = "rgba(0,0,0,.40)"
    else:
        bg = "#f5f8fc"; panel = "#ffffff"; panel2 = "#eaf3ff"; text = "#0f172a"; muted = "#475569"; border = "rgba(15,23,42,.12)"; accent = "#0284c7"; good = "#16a34a"; warn = "#d97706"; shadow = "rgba(15,23,42,.10)"
    sidebar_css = """
    :root {
        --lb-sidebar-width:16.4rem;
        --lb-sidebar-motion:320ms cubic-bezier(.22,.61,.36,1);
    }
    section[data-testid="stSidebar"], [data-testid="stSidebar"] {
        display:block !important; visibility:visible !important; opacity:1 !important;
        width:var(--lb-sidebar-width) !important; min-width:var(--lb-sidebar-width) !important; max-width:var(--lb-sidebar-width) !important;
        margin-left:0 !important;
        transform:translate3d(0,0,0) !important;
        transition:margin-left var(--lb-sidebar-motion) !important;
        will-change:margin-left;
        backface-visibility:hidden;
        contain:paint;
        z-index:1000 !important;
    }
    [data-testid="stSidebarContent"] {
        display:block !important; visibility:visible !important; opacity:1 !important;
        transform:translate3d(0,0,0);
        transition:transform var(--lb-sidebar-motion) !important;
        will-change:transform;
        backface-visibility:hidden;
    }
    body.lb-sidebar-hidden section[data-testid="stSidebar"],
    body.lb-sidebar-hidden [data-testid="stSidebar"] {
        margin-left:calc(-1 * var(--lb-sidebar-width)) !important;
    }
    /* Give the panel itself compositor motion while the negative margin reclaims
       layout space. The small inner transform masks flex-layout stepping without
       doubling the sidebar travel distance. */
    body.lb-sidebar-hidden [data-testid="stSidebarContent"] {
        transform:translate3d(-.45rem,0,0);
    }
    [data-testid="stAppViewContainer"] > .main {
        transform:translate3d(0,0,0);
        backface-visibility:hidden;
    }
    [data-testid="stAppViewContainer"] .main .block-container {max-width:1500px !important;}

    /* Minimal top-right handle. When the sidebar is open it lives clearly
       inside the panel; when closed it glides to the left edge and remains
       reachable. The visible control is two horizontal chevrons only. */
    #lb-sidebar-toggle {
        position:fixed;
        top:.82rem;
        left:calc(var(--lb-sidebar-width) - 3.35rem);
        z-index:2147483647;
        width:2.85rem;
        height:2.35rem;
        padding:0;
        margin:0;
        border:0 !important;
        outline:0 !important;
        border-radius:.55rem !important;
        background:transparent !important;
        box-shadow:none !important;
        color:rgba(186,230,253,.70);
        cursor:pointer;
        display:flex;
        flex-direction:row;
        align-items:center;
        justify-content:center;
        gap:.13rem;
        transition:left var(--lb-sidebar-motion), color 140ms ease, opacity 140ms ease, transform 140ms ease;
        will-change:left,transform;
        -webkit-tap-highlight-color:transparent;
        user-select:none;
    }
    #lb-sidebar-toggle .lb-sidebar-chevron {
        display:block;
        font-size:1.72rem;
        font-family:Arial,Helvetica,sans-serif;
        font-weight:300;
        line-height:1;
        letter-spacing:0;
        transform:translateY(-.04rem);
        text-shadow:0 0 11px rgba(56,189,248,0);
        transition:transform 140ms ease, color 140ms ease, text-shadow 140ms ease;
        pointer-events:none;
    }
    #lb-sidebar-toggle:hover,
    #lb-sidebar-toggle:focus-visible {
        color:#7dd3fc;
        transform:translateX(-1px);
        background:rgba(56,189,248,.045) !important;
    }
    #lb-sidebar-toggle:hover .lb-sidebar-chevron,
    #lb-sidebar-toggle:focus-visible .lb-sidebar-chevron {
        text-shadow:0 0 11px rgba(56,189,248,.42);
    }
    #lb-sidebar-toggle:active {transform:translateX(-2px) scale(.95);}
    body.lb-sidebar-hidden #lb-sidebar-toggle {
        left:.28rem;
        color:rgba(125,211,252,.80);
    }
    body.lb-sidebar-hidden #lb-sidebar-toggle:hover,
    body.lb-sidebar-hidden #lb-sidebar-toggle:focus-visible {transform:translateX(1px);}
    body.lb-sidebar-hidden #lb-sidebar-toggle:active {transform:translateX(2px) scale(.95);}

    @media (prefers-reduced-motion: reduce) {
        section[data-testid="stSidebar"], [data-testid="stSidebar"], [data-testid="stSidebarContent"], #lb-sidebar-toggle {transition:none !important;}
    }
    @media (max-width: 760px) {
        #lb-sidebar-toggle {top:.68rem; left:calc(var(--lb-sidebar-width) - 3.18rem); width:2.72rem; height:2.28rem;}
        #lb-sidebar-toggle .lb-sidebar-chevron {font-size:1.62rem;}
        body.lb-sidebar-hidden #lb-sidebar-toggle {left:.18rem;}
    }
    """

    st.markdown(f"""
    <style>
    :root {{--bg:{bg};--panel:{panel};--panel2:{panel2};--text:{text};--muted:{muted};--border:{border};--accent:{accent};--good:{good};--warn:{warn};--shadow:{shadow};}}
    /* Streamlit chrome: hide the top header completely. Do NOT rely on the
       native collapsed sidebar button; on Streamlit Cloud it is not rendered
       consistently when the header is hidden. Instead we force the sidebar to
       stay visible and accessible. */
    header[data-testid="stHeader"] {{display:block !important; visibility:visible !important; height:0 !important; min-height:0 !important; background:transparent !important; pointer-events:none !important; z-index:999998 !important; overflow:visible !important;}}
    header[data-testid="stHeader"] * {{pointer-events:none !important;}}
    div[data-testid="stToolbar"], div[data-testid="stDecoration"], div[data-testid="stStatusWidget"], #MainMenu, footer {{display:none !important; visibility:hidden !important; height:0 !important;}}
    .stDeployButton {{display:none !important;}}
    [data-testid="stSidebarHeader"], [data-testid="stSidebarCollapseButton"], [data-testid="collapsedControl"], [data-testid="stSidebarCollapsedControl"],
    section[data-testid="stSidebar"] [data-testid="stSidebarHeader"],
    section[data-testid="stSidebar"] [data-testid="stSidebarHeader"] button,
    section[data-testid="stSidebar"] button[kind="headerNoPadding"],
    section[data-testid="stSidebar"] button[data-testid="baseButton-headerNoPadding"],
    button[title*="sidebar" i], button[aria-label*="sidebar" i],
    button[title*="Collapse" i], button[aria-label*="Collapse" i],
    button[title*="Close" i], button[aria-label*="Close" i] {{display:none !important; visibility:hidden !important; pointer-events:none !important; width:0 !important; height:0 !important; padding:0 !important; margin:0 !important;}}
    {sidebar_css}
    [data-testid="stAppViewContainer"] > .main {{padding-top:0 !important;}}
    [data-testid="stAppViewContainer"] .main .block-container {{padding-top:0 !important; margin-top:0 !important;}}
    .stApp {{background: radial-gradient(circle at 16% 10%, rgba(56,189,248,.16), transparent 24%), radial-gradient(circle at 88% 3%, rgba(34,197,94,.08), transparent 26%), var(--bg); color:var(--text);}}
    [data-testid="stSidebar"] {{background: linear-gradient(180deg, rgba(11,24,42,.98), rgba(6,16,29,.98)); border-right:1px solid var(--border);}}
    [data-testid="stSidebar"] * {{color:#e6f0fb;}}
    .block-container {{padding-top:0 !important; padding-bottom:3rem; max-width:1500px;}}
    h1,h2,h3 {{letter-spacing:-.025em;}}
    .app-title {{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.05rem 1.25rem;border:1px solid var(--border);background:linear-gradient(135deg,rgba(56,189,248,.14),rgba(15,23,42,.04)),var(--panel);border-radius:20px;box-shadow:0 16px 38px var(--shadow);margin-bottom:1rem;}}
    .app-title-main {{font-size:1.55rem;font-weight:850;color:var(--text);line-height:1.1;}}
    .app-title-sub {{font-size:.86rem;color:var(--muted);margin-top:.18rem;}}
    .sidebar-version {{color:var(--muted);font-size:.78rem;margin-top:-.4rem;margin-bottom:1rem;}}
    .app-badge {{font-size:.78rem;font-weight:800;color:#031421;background:linear-gradient(135deg,var(--accent),#a7f3d0);border-radius:999px;padding:.38rem .72rem;white-space:nowrap;}}
    .metric-card {{border:1px solid var(--border);border-radius:18px;padding:1rem 1.05rem;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent),var(--panel);box-shadow:0 12px 30px var(--shadow);min-height:108px;}}
    .metric-label {{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;}}
    .metric-value {{color:var(--text);font-size:1.72rem;line-height:1.25;font-weight:850;margin-top:.25rem;}}
    .metric-sub {{color:var(--muted);font-size:.82rem;margin-top:.28rem;}}
    #lb-page-loader {{position:fixed;left:var(--lb-sidebar-width);right:0;top:0;bottom:0;z-index:2147483000;display:flex;align-items:flex-start;justify-content:center;padding-top:5.8rem;background:rgba(6,16,29,.10);opacity:0;pointer-events:none;transition:opacity 120ms ease;}}
    body.lb-sidebar-hidden #lb-page-loader {{left:0;}}
    body.lb-page-loading #lb-page-loader {{opacity:1;}}
    .lb-plane-spinner {{width:2.25rem;height:2.25rem;border-radius:999px;border:1px solid rgba(56,189,248,.30);background:rgba(9,22,39,.82);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(0,0,0,.28),0 0 0 4px rgba(56,189,248,.045);color:#a7f3ff;}}
    .lb-plane-spinner span {{display:block;font-size:1.20rem;line-height:1;animation:lbPlaneSpin .78s linear infinite;transform-origin:center center;}}
    @keyframes lbPlaneSpin {{from {{transform:rotate(0deg);}} to {{transform:rotate(360deg);}}}}
    .map-mode-row {{margin:.35rem 0 .65rem 0;}}
    .map-selection-panel {{border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.035),transparent),var(--panel);padding:.95rem 1.05rem;margin:.8rem 0 1rem 0;box-shadow:0 12px 28px var(--shadow);}}
    .map-selection-title {{font-size:1.06rem;font-weight:900;color:var(--text);letter-spacing:-.015em;margin-bottom:.4rem;}}
    .map-selection-meta {{display:flex;gap:.45rem;flex-wrap:wrap;color:var(--muted);font-size:.82rem;margin-bottom:.65rem;}}
    .map-selection-meta span {{border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.035);padding:.16rem .48rem;}}
    .map-mini-head {{color:var(--muted);font-size:.68rem;text-transform:uppercase;letter-spacing:.07em;font-weight:850;padding:.22rem 0;}}
    .map-mini-cell {{border-top:1px solid rgba(148,163,184,.12);padding:.38rem 0;color:var(--text);font-size:.84rem;line-height:1.2;}}
    .map-mini-sub {{color:var(--muted);font-size:.75rem;margin-top:.08rem;}}

    .flight-detail-hero {{border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,rgba(56,189,248,.12),rgba(15,23,42,.02)),var(--panel);padding:1rem 1.1rem;margin:.15rem 0 1rem 0;box-shadow:0 12px 28px var(--shadow);}}
    .flight-detail-route {{font-size:1.35rem;font-weight:900;color:var(--text);line-height:1.15;letter-spacing:-.025em;}}
    .flight-detail-meta {{color:var(--muted);font-size:.86rem;margin-top:.35rem;display:flex;gap:.55rem;flex-wrap:wrap;}}
    .flight-detail-meta span {{border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.035);padding:.18rem .50rem;}}
    .detail-grid {{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem;margin:.8rem 0;}}
    .detail-card {{border:1px solid var(--border);border-radius:16px;background:var(--panel);padding:.78rem .85rem;box-shadow:0 10px 24px var(--shadow);min-height:5.4rem;}}
    .detail-card-label {{font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:850;margin-bottom:.32rem;}}
    .detail-card-value {{font-size:1.08rem;color:var(--text);font-weight:900;line-height:1.1;}}
    .detail-card-sub {{font-size:.78rem;color:var(--muted);margin-top:.25rem;line-height:1.25;}}
    .detail-split {{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:.55rem 0 .9rem 0;}}
    .detail-kv {{border:1px solid var(--border);border-radius:16px;background:rgba(255,255,255,.025);padding:.8rem .9rem;}}
    .detail-kv-title {{font-weight:900;color:var(--text);margin-bottom:.45rem;}}
    .detail-kv-row {{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid rgba(148,163,184,.12);padding:.42rem 0;font-size:.88rem;}}
    .detail-kv-row:first-of-type {{border-top:0;}}
    .detail-kv-row span:first-child {{color:var(--muted);}}
    .detail-kv-row span:last-child {{color:var(--text);font-weight:750;text-align:right;}}
    .section-card {{border:1px solid var(--border);border-radius:18px;padding:1rem;background:var(--panel);box-shadow:0 10px 28px var(--shadow);}}
    .pill {{display:inline-block;border:1px solid var(--border);border-radius:999px;background:var(--panel2);padding:.25rem .62rem;margin:.1rem .18rem;font-size:.82rem;color:var(--text);}}
    div[data-testid="stDataFrame"], div[data-testid="stDataEditor"] {{border-radius:16px;overflow:hidden;}}
    .flight-help {{color:var(--muted);font-size:.86rem;margin:.25rem 0 .75rem 0;}}
    .quick-form-panel {{border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.035),transparent),var(--panel);padding:.85rem 1rem;margin:.55rem 0 1rem 0;box-shadow:0 10px 24px var(--shadow);}}
    .quick-form-title {{font-size:1rem;font-weight:900;color:var(--text);letter-spacing:-.015em;margin-bottom:.42rem;}}
    .quick-form-meta {{display:flex;gap:.4rem;flex-wrap:wrap;color:var(--muted);font-size:.78rem;margin:.2rem 0 .6rem 0;}}
    .quick-form-meta span {{border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.03);padding:.14rem .45rem;}}

    .flight-list-note {{color:var(--muted);font-size:.84rem;margin:.25rem 0 .6rem 0;}}
    .flight-list-head {{font-size:.70rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:850;padding:.12rem .15rem .32rem .15rem;border-bottom:1px solid var(--border);height:1.55rem;display:flex;align-items:flex-end;white-space:nowrap;}}
    .flight-list-first-gap {{height:.38rem;}}
    .flight-cell {{font-size:.78rem;line-height:1.08;padding:.14rem .15rem .06rem .15rem;color:var(--text);min-height:1.86rem;display:flex;flex-direction:column;justify-content:flex-start;}}
    .flight-cell-main {{font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
    .flight-cell-sub {{font-size:.68rem;color:var(--muted);margin-top:.12rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
    .flight-row-sep {{height:1px;background:rgba(148,163,184,.10);margin:.18rem 0 .16rem 0;}}
    .flight-page-info {{color:var(--muted);font-size:.82rem;padding-top:1.85rem;text-align:right;}}
    div[data-testid="stButton"] > button {{white-space:nowrap;}}
    .flight-status {{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid var(--border);padding:.10rem .42rem;font-size:.66rem;font-weight:900;line-height:1;white-space:nowrap;max-width:100%;}}
    .flight-status-ok {{color:#a7f3d0;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.32);}}
    .flight-status-warn {{color:#fde68a;background:rgba(245,158,11,.13);border-color:rgba(245,158,11,.34);}}
    .flight-status-error {{color:#fecaca;background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.36);}}
    .flight-filter-bar {{border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.035),transparent),var(--panel);padding:.85rem 1rem;margin:.4rem 0 1rem 0;box-shadow:0 10px 24px var(--shadow);}}
    .flight-filter-meta {{display:flex;gap:.42rem;flex-wrap:wrap;margin:.4rem 0 .2rem 0;color:var(--muted);font-size:.78rem;}}
    .flight-filter-meta span {{border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.03);padding:.14rem .45rem;}}
    .selected-flight-box {{border:1px solid var(--border); border-radius:14px; padding:.65rem .85rem; background:rgba(56,189,248,.07); margin:.5rem 0 .75rem 0;}}
    .selected-flight-title {{font-weight:850;color:var(--text);}}
    .selected-flight-sub {{font-size:.82rem;color:var(--muted);margin-top:.1rem;}}
    /* Horizontal radios are used as lazy page-section navigation.  Unlike
       st.tabs they do not force hidden sections to render on every rerun. */
    div[data-testid="stRadio"] div[role="radiogroup"] {{gap:.34rem;flex-wrap:wrap;}}
    div[data-testid="stRadio"] div[role="radiogroup"] label {{border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.025);padding:.18rem .55rem;margin:0;transition:background 120ms ease,border-color 120ms ease;}}
    div[data-testid="stRadio"] div[role="radiogroup"] label:hover {{background:rgba(56,189,248,.07);border-color:rgba(56,189,248,.35);}}
    div[data-testid="stRadio"] div[role="radiogroup"] label:has(input:checked) {{background:rgba(56,189,248,.12);border-color:rgba(56,189,248,.50);}}
    div.stButton > button {{border-radius:14px !important; font-weight:800 !important; border:1px solid var(--border) !important; min-height:2.05rem; padding:.22rem .60rem !important;}}
    .stButton {{margin-top:0 !important;}}
    [data-testid="column"] .stButton > button {{min-height:1.72rem !important;padding:.08rem .32rem !important;border-radius:11px !important;font-size:.74rem !important;white-space:nowrap !important;line-height:1 !important;overflow:hidden !important;}}
    [data-testid="column"] .stButton > button p {{white-space:nowrap !important;line-height:1 !important;margin:0 !important;}}
    div.stButton > button[kind="primary"] {{box-shadow:0 10px 22px rgba(56,189,248,.18) !important;}}
    div[data-testid="stExpander"] {{border:1px solid var(--border); border-radius:16px; background:rgba(255,255,255,.025);}}
    div[data-testid="stDialog"] div[role="dialog"] {{border:1px solid var(--border); border-radius:22px;}}
    button[kind="primary"] {{border-radius:12px;}}
    @media (max-width: 980px) {{.detail-grid {{grid-template-columns:repeat(2,minmax(0,1fr));}} .detail-split {{grid-template-columns:1fr;}}}}
    @media (max-width: 760px) {{.block-container {{padding-left:.75rem;padding-right:.75rem;}} .app-title {{padding:.85rem;border-radius:15px;}} .app-title-main {{font-size:1.2rem;}} .metric-value {{font-size:1.35rem;}} .detail-grid {{grid-template-columns:1fr;}}}}
    
        .compact-import-hero {{margin:1rem 0 1rem 0;padding:1rem 1.15rem;}}
        </style>
    """, unsafe_allow_html=True)

def app_header(subtitle: str = "Osobní letový zápisník") -> None:
    st.markdown(f"""
    <div class="app-title">
      <div><div class="app-title-main">Letový zápisník</div><div class="app-title-sub">{subtitle}</div></div>
      <div class="app-badge">{APP_VERSION}</div>
    </div>
    """, unsafe_allow_html=True)

def metric_card(label: str, value: str, sub: str = "") -> None:
    st.markdown(f"""
    <div class="metric-card"><div class="metric-label">{label}</div><div class="metric-value">{value}</div><div class="metric-sub">{sub}</div></div>
    """, unsafe_allow_html=True)

def plotly_layout(fig):
    fig.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=dict(color="#e5edf7"), margin=dict(l=10, r=10, t=45, b=10), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    fig.update_xaxes(gridcolor="rgba(148,163,184,.18)")
    fig.update_yaxes(gridcolor="rgba(148,163,184,.18)")
    return fig

