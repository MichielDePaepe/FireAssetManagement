# Fireplan inventory dependencies

`PyYAML` is a direct backend dependency because the Python standard library has no YAML parser. `backend/fireplan/inventory_mapping.py` uses `yaml.safe_load` to read the small extraction map in `backend/fireplan/inventory_mapping.yaml`; it does not load arbitrary Python objects or provide a general-purpose mapping engine. The current map selects the French container name `Cabine de conduite` and item type ID `1010`, and checks the readable source name `Radio portable Astrid`.

Fireplan container UUIDs are inventory-specific. Resolve the selected container ID from each inventory's tree before requesting its item list. TEI values are kept as strings. Fireplan datetimes with no UTC offset are interpreted in `Europe/Brussels`; explicit offsets are retained.
