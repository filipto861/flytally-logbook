# Navigation Performance v0.69.1

## Regression observed
After v0.69 hardening, sidebar page changes felt slower even though the active-page data loaders remained lazy.

## Primary cause
A Streamlit button click already starts one script rerun. The navigation handler then called `st.rerun()` again after writing `session_state["page"]`. Therefore one menu click caused:

1. click-triggered rerun;
2. authentication + sidebar + common shell work;
3. explicit abort through `st.rerun()`;
4. second full rerun;
5. target page render.

This pattern predated v0.69, but the additional v0.69 hardening made the wasted first pass more noticeable.

## Fix
Sidebar navigation is now callback-driven. The callback updates the page before the click-triggered rerun executes, so the same single rerun renders the selected page.

No security or database hardening from v0.69 is reverted.

## Secondary optimization
Current-user profile data is fetched through the existing 300-second Streamlit data cache only once per script run. Subsequent role/name/currency/timezone/default lookups use a request-local dict reference. The dict is reinitialized on every rerun, so this is not a new persistence boundary.
