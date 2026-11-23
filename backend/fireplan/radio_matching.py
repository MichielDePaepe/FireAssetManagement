from assets.models import Radio


def normalized_observation_tei(value: str) -> str | None:
    """Return a canonical TEI for valid 14- or 15-digit FirePlan values."""
    if not value.isascii() or not value.isdigit():
        return None
    if len(value) == 14:
        return f"{value}0"
    if len(value) == 15:
        return value
    return None


def radio_ids_by_observation_tei(values: set[str]) -> dict[str, int]:
    teis = {tei for value in values if (tei := normalized_observation_tei(value))}
    if not teis:
        return {}
    return dict(Radio.objects.filter(tei__in=teis).values_list("tei", "pk"))


def matched_radio_id(value: str, radio_ids_by_tei: dict[str, int]) -> int | None:
    tei = normalized_observation_tei(value)
    return radio_ids_by_tei.get(tei) if tei else None
