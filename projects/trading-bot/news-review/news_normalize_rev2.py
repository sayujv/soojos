"""news_normalize — deterministic news ingest, slice 1 (rev 2).

Does: validate, normalise, deduplicate, order, and expose as-of visibility for news records.
Must never: perform I/O, read a clock, consult published_at for visibility, merge records,
truncate timestamp precision, or let an exception escape from a single bad record.

NOT RUN BY THE AUTHOR (Build/Claude, 2026-09-17, rev 2). Astra executes first.
Requires Python >= 3.11.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, fields
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

SOURCE_CLASSES = frozenset({"newswire", "filing", "press", "transcript", "broker_note", "blog"})
REQUIRED = ("source", "title", "published_at", "ingested_at")
_SEP = "\x1f"
_FMT = "%Y-%m-%dT%H:%M:%S.%fZ"

_CHAR_MAP = str.maketrans({
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
    "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-", "\u2015": "-",
    "\u00a0": " ", "\u2009": " ", "\u200b": " ", "\u202f": " ", "\ufeff": " ",
})
_WS = re.compile(r"\s+")


@dataclass(frozen=True)
class NormItem:
    item_id: str
    dedupe_key: str
    content_hash: str
    source_norm: str
    source_class: str | None
    title_raw: str
    title_norm: str
    body_norm: str
    published_at_utc: str
    published_date_utc: str
    ingested_at_utc: str
    as_of_utc: str
    url: str | None
    tickers: tuple[str, ...]
    source_id: str | None


@dataclass(frozen=True)
class Reject:
    index: int
    reason: str
    detail: str
    raw: dict | None


@dataclass(frozen=True)
class NormalizeResult:
    items: tuple[NormItem, ...]
    rejects: tuple[Reject, ...]
    duplicates: tuple[tuple[str, str], ...]


class _RejectError(Exception):
    def __init__(self, reason: str, detail: str = "") -> None:
        super().__init__(reason)
        self.reason, self.detail = reason, detail


def norm_text(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).translate(_CHAR_MAP).casefold()
    return _WS.sub(" ", s).strip()


def strip_own_source_suffix(title_norm: str, source_norm: str) -> str:
    """Remove a trailing ' - <source>' or ' | <source>' only when <source> equals this record's source_norm."""
    for sep in (" - ", " | "):
        suffix = sep + source_norm
        if source_norm and title_norm.endswith(suffix) and len(title_norm) > len(suffix):
            return title_norm[: -len(suffix)].rstrip()
    return title_norm


def norm_time(value: Any, field: str) -> datetime:
    if not isinstance(value, str):
        raise _RejectError(f"BAD_TYPE:{field}", type(value).__name__)
    try:
        dt = datetime.fromisoformat(value)
    except ValueError as e:
        raise _RejectError(f"BAD_TIMESTAMP:{field}", str(e)) from None
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise _RejectError(f"TZ_NAIVE:{field}", value)
    return dt.astimezone(timezone.utc)


def _render(dt: datetime) -> str:
    return dt.strftime(_FMT)


def _sha(*parts: str) -> str:
    return hashlib.sha256(_SEP.join(parts).encode("utf-8")).hexdigest()


def _opt_str(rec: dict, key: str) -> str | None:
    v = rec.get(key)
    if v is None:
        return None
    if not isinstance(v, str):
        raise _RejectError(f"BAD_TYPE:{key}", type(v).__name__)
    v = v.strip()
    return v or None


def _one(rec: Any, skew: timedelta) -> NormItem:
    if not isinstance(rec, dict):
        raise _RejectError("NOT_A_DICT", type(rec).__name__)
    for f in REQUIRED:
        if rec.get(f) is None:
            raise _RejectError(f"MISSING_FIELD:{f}")
    # Type checks first, for every field, before any value check.
    for f in ("source", "title"):
        if not isinstance(rec[f], str):
            raise _RejectError(f"BAD_TYPE:{f}", type(rec[f]).__name__)
    body = rec.get("body")
    if body is None:
        body = ""
    if not isinstance(body, str):
        raise _RejectError("BAD_TYPE:body", type(body).__name__)
    for f in ("published_at", "ingested_at"):
        if not isinstance(rec[f], str):
            raise _RejectError(f"BAD_TYPE:{f}", type(rec[f]).__name__)
    sc = rec.get("source_class")
    if sc is not None and not isinstance(sc, str):
        raise _RejectError("BAD_TYPE:source_class", type(sc).__name__)
    raw_t = rec.get("tickers")
    if raw_t is None:
        raw_t = ()
    if not isinstance(raw_t, (list, tuple)):
        raise _RejectError("BAD_TYPE:tickers", type(raw_t).__name__)
    url = _opt_str(rec, "url")
    source_id = _opt_str(rec, "source_id")

    # Value checks.
    source_norm = norm_text(rec["source"])
    title_norm = strip_own_source_suffix(norm_text(rec["title"]), source_norm)
    if not title_norm:
        raise _RejectError("EMPTY_TITLE")
    if not source_norm:
        raise _RejectError("EMPTY_SOURCE")

    pub = norm_time(rec["published_at"], "published_at")
    ing = norm_time(rec["ingested_at"], "ingested_at")
    if pub > ing + skew:
        raise _RejectError("PUBLISHED_AFTER_INGESTED",
                           f"{_render(pub)} > {_render(ing)} + {int(skew.total_seconds())}s")

    if sc is not None and sc not in SOURCE_CLASSES:
        raise _RejectError("BAD_SOURCE_CLASS", sc)

    tick: set[str] = set()
    for t in raw_t:
        if not isinstance(t, str) or not t.strip():
            raise _RejectError("BAD_TICKER", repr(t))
        tick.add(t.strip().upper())
    tickers = tuple(sorted(tick))

    pub_s, ing_s = _render(pub), _render(ing)
    pub_d = pub_s[:10]
    item_id = _sha(source_norm, source_id or "", title_norm, pub_s, url or "")
    dedupe_key = _sha(source_norm, title_norm, pub_d)
    content_hash = _sha(
        source_norm, sc or "", rec["title"], title_norm, norm_text(body),
        pub_s, pub_d, ing_s, ing_s, url or "", ",".join(tickers), source_id or "",
    )
    return NormItem(
        item_id=item_id,
        dedupe_key=dedupe_key,
        content_hash=content_hash,
        source_norm=source_norm,
        source_class=sc,
        title_raw=rec["title"],
        title_norm=title_norm,
        body_norm=norm_text(body),
        published_at_utc=pub_s,
        published_date_utc=pub_d,
        ingested_at_utc=ing_s,
        as_of_utc=ing_s,
        url=url,
        tickers=tickers,
        source_id=source_id,
    )


def normalize(records: Iterable[Any], *, skew_seconds: int = 300) -> NormalizeResult:
    try:
        it = iter(records)
    except TypeError:
        raise TypeError("records must be iterable") from None
    skew = timedelta(seconds=skew_seconds)
    ok: list[NormItem] = []
    rejects: list[Reject] = []
    for i, rec in enumerate(it):
        try:
            ok.append(_one(rec, skew))
        except _RejectError as e:
            rejects.append(Reject(i, e.reason, e.detail, rec if isinstance(rec, dict) else None))
    ok.sort(key=lambda x: (x.ingested_at_utc, x.item_id, x.content_hash))
    seen: dict[str, str] = {}
    kept: list[NormItem] = []
    dups: list[tuple[str, str]] = []
    for item in ok:
        k = seen.get(item.dedupe_key)
        if k is None:
            seen[item.dedupe_key] = item.item_id
            kept.append(item)
        else:
            dups.append((item.item_id, k))
    return NormalizeResult(tuple(kept), tuple(rejects), tuple(dups))


def visible_as_of(items: Iterable[NormItem], as_of_utc: str) -> tuple[NormItem, ...]:
    try:
        cut = norm_time(as_of_utc, "as_of_utc")
    except _RejectError as e:
        raise ValueError(f"{e.reason}: {e.detail}") from None
    out = []
    for x in items:
        if datetime.strptime(x.ingested_at_utc, _FMT).replace(tzinfo=timezone.utc) <= cut:
            out.append(x)
    return tuple(out)


_ = fields  # referenced for readers checking content_hash field coverage against NormItem
