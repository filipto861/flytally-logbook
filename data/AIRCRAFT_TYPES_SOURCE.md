# FlyTally aircraft type catalogue

FlyTally's bundled aircraft identity catalogue is generated from **FAA Order JO 7360.1K — Aircraft Type Designators**, a public FAA directive containing aircraft type designators, manufacturers and models used for air traffic services.

Source: https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.current/documentNumber/7360.1

The catalogue is a convenience/search layer, not a regulatory determination. The original FAA/ICAO source remains authoritative for type-designator use.

`classHint` is deliberately non-binding. FlyTally may suggest SEP/MEP/SET only from an unambiguous fixed-wing engine configuration in the source (for example one piston engine), but Part-FCL class is a separate pilot-confirmed field and the suggestion is never certification evidence.

Some ultralight or newly introduced aircraft may not have an individual designator. FlyTally always supports manual Make/Model/ICAO entry and must never block aircraft creation merely because a type is absent from this catalogue.
