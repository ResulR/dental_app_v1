#!/usr/bin/env python3
"""Offline proposal only: never run or install as the privileged migration gate."""
import hashlib
import re

# These exceptions are reviewable *bytes*, not a general relaxation of SQL policy.
EXCEPTIONS = {
    "0022_delivery_batch_receipts.sql": "e259575c72f6c9b84aca172bcbdbcd7a67f5245f18f1902a926d33118e838cd4",
    "0023_conversation_read_markers_backfill.sql": "5eaa63d58c26e3b49377313ba9739a6b4d38daecbb0c4152e29d50a47d6e45bf",
}
DOLLAR = re.compile(r"\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$")
WORD = re.compile(r"[A-Za-z_][A-Za-z_0-9]*")
FORBIDDEN = {"BEGIN", "START", "COMMIT", "ROLLBACK", "ABORT", "SAVEPOINT",
             "RELEASE", "PREPARE", "DISCARD", "RESET", "SET_CONFIG", "NEXTVAL",
             "SETVAL", "CALL", "COPY"}


def statements(sql):
    """Tokenize top-level SQL; semicolons inside quotes/comments/dollar bodies are opaque."""
    parts, tokens, i, n = [], [], 0, len(sql)
    while i < n:
        if sql.startswith("--", i):
            end = sql.find("\n", i + 2)
            i = n if end == -1 else end + 1
        elif sql.startswith("/*", i):
            depth = 1
            i += 2
            while depth and i < n:
                if sql.startswith("/*", i):
                    depth += 1
                    i += 2
                elif sql.startswith("*/", i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
            if depth:
                raise ValueError("UNCLOSED_COMMENT")
        elif sql[i] in ("'", '"'):
            quote = sql[i]
            i += 1
            while i < n:
                if sql[i] == quote:
                    if i + 1 < n and sql[i + 1] == quote:
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            else:
                raise ValueError("UNCLOSED_QUOTE")
            tokens.append("LITERAL")
        elif sql[i] == "$":
            match = DOLLAR.match(sql, i)
            if match is None:
                raise ValueError("UNSUPPORTED_DOLLAR")
            tag = match.group()
            end = sql.find(tag, match.end())
            if end == -1:
                raise ValueError("UNCLOSED_DOLLAR")
            i = end + len(tag)
            tokens.append("BODY")
        elif sql[i] == ";":
            if not tokens:
                raise ValueError("EMPTY_STATEMENT")
            parts.append(tokens)
            tokens = []
            i += 1
        elif sql[i].isspace():
            i += 1
        elif match := WORD.match(sql, i):
            tokens.append(match.group().upper())
            i = match.end()
        elif sql[i].isdigit():
            end = i + 1
            while end < n and sql[end].isdigit():
                end += 1
            tokens.append("NUMBER")
            i = end
        elif sql[i] in "().,=*<>+-?:":
            tokens.append(sql[i])
            i += 1
        else:
            raise ValueError("UNSUPPORTED_SQL_CHARACTER")
    if tokens:
        raise ValueError("MISSING_FINAL_SEMICOLON")
    return parts


def validate_exception(name, expected, data):
    if name not in EXCEPTIONS:
        raise ValueError("NOT_EXCEPTION")
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected or digest != EXCEPTIONS[name]:
        raise ValueError("EXCEPTION_BYTES_NOT_REVIEWED")
    sql = data.decode("utf-8")
    if not sql.strip() or "\x00" in sql or "\\" in sql or "\ufeff" in sql:
        raise ValueError("UNSAFE_SQL_BYTES")
    parts = statements(sql)
    heads = []
    for tokens in parts:
        if FORBIDDEN.intersection(tokens):
            raise ValueError("FORBIDDEN_TOP_LEVEL_TOKEN")
        heads.append(tuple(tokens[:3]))
    if name.startswith("0022_"):
        shapes = [
            ("CREATE", "TABLE", "PUBLIC"), ("CREATE", "INDEX", "DELIVERY_BATCH_RECEIPTS_ACTOR_CREATED_IDX"),
            ("CREATE", "FUNCTION", "PUBLIC"), ("CREATE", "TRIGGER", "DELIVERY_BATCH_RECEIPT_FINALIZATION"),
            ("CREATE", "FUNCTION", "PUBLIC"), ("CREATE", "TRIGGER", "DELIVERY_BATCH_RECEIPT_INSERT"),
            ("CREATE", "FUNCTION", "PUBLIC"), ("CREATE", "CONSTRAINT", "TRIGGER"),
            ("GRANT", "SELECT", ","), ("GRANT", "UPDATE", "("),
        ]
        if heads != shapes:
            raise ValueError("UNREVIEWED_STATEMENT_SHAPE")
        for tokens in parts:
            if "SET" in tokens and not (tokens[:2] == ["CREATE", "FUNCTION"]
                                        and tokens.count("SET") == 1
                                        and ("SET", "SEARCH_PATH") == tuple(tokens[tokens.index("SET"):tokens.index("SET")+2])):
                raise ValueError("UNREVIEWED_SET")
            if "DO" in tokens:
                raise ValueError("UNREVIEWED_DO")
        if sum(tokens.count("BODY") for tokens in parts) != 3:
            raise ValueError("UNREVIEWED_FUNCTION_BODY")
    else:
        if len(parts) != 1 or heads != [("INSERT", "INTO", "PUBLIC")]:
            raise ValueError("UNREVIEWED_BACKFILL_SHAPE")
        tokens = parts[0]
        if any(word in tokens for word in ("SET", "BODY")):
            raise ValueError("UNREVIEWED_BACKFILL_TOKEN")
        if "ON" not in tokens or tokens[-2:] != ["DO", "NOTHING"] or tokens.count("DO") != 1:
            raise ValueError("UNREVIEWED_CONFLICT_POLICY")
    return True


def validate(name, expected, data, historical_validate):
    """Standalone adapter; historical_validate is the reviewed v3 validate function."""
    if name in EXCEPTIONS:
        return validate_exception(name, expected, data)
    return historical_validate(name, expected, data)
