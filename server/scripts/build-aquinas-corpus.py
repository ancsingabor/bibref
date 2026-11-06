#!/usr/bin/env python3
"""Validate an explicitly sectioned local edition and create a private corpus bundle."""
import argparse
import hashlib
import json
import re
import runpy
import unicodedata
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode(data):
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def require(condition, category):
    if not condition:
        raise ValueError(category)


def article_pack(article, manifest, expected_contrary=1):
    require(re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", article["id"]), "article locator")
    require(article["title"] and article["questionTitle"], "article headings")
    sections = article["sections"]
    roles = [section["role"] for section in sections]
    require(roles.count("respondeo") == 1 and roles.count("sed_contra") == expected_contrary, "article structure")
    objections = set()
    ids = set()
    order = ["objection", "sed_contra", "respondeo", "reply"]
    require(all(role in order for role in roles) and roles == sorted(roles, key=order.index), "section roles")
    for section in sections:
        require(re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", section["id"]) and section["id"] not in ids, "section locator")
        ids.add(section["id"])
        text = unicodedata.normalize("NFC", section["text"])
        require(text.strip() and "\0" not in text, "section text")
        section["text"] = text
        section["hash"] = digest(text.encode())
        if section["role"] == "objection":
            number = section["number"]
            require(type(number) is int and number > 0 and number not in objections, "objection number")
            objections.add(number)
        if section["role"] == "reply":
            links = section["respondsTo"]
            require(links and set(links) <= objections and len(links) == len(set(links)), "reply references")
            require(len(links) == 1 or section.get("collectiveReply") is True, "collective reply")
    article.update(editionId=manifest["editionId"], sourceLanguage=manifest["sourceLanguage"])
    require(len(encode(article)) <= 256 * 1024, "article size")
    return article


def build(source, manifest, topics):
    require(manifest["rightsStatus"] in {"fixture", "approved", "disabled"}, "rights status")
    require(digest(source) == manifest["sourceChecksum"] and digest(topics) == manifest["topicsChecksum"], "input checksums")
    require(all(manifest.get(key) for key in ("workId", "editionId", "sourceUrl", "sourceLanguage", "extractionVersion", "notices")), "edition provenance")
    if manifest["rightsStatus"] == "approved":
        require(all(manifest.get(key) for key in ("rightsEvidenceRef", "jurisdictions", "approvedAt")), "rights evidence")
    selected = manifest["allowedArticles"]
    require(len(selected) == len(set(selected)), "duplicate allowlist locator")
    no_contrary = set()
    if manifest.get("extractionVersion") == "gutenberg-17611-v1":
        extractor = runpy.run_path(str(Path(__file__).with_name("aquinas-gutenberg.py")))
        records = extractor["extract_articles"](source)
        no_contrary = extractor["NO_STANDALONE_CONTRARY"]
    else:
        records = json.loads(source)
    articles = [article_pack(article, manifest, int(article["id"] not in no_contrary))
                for article in records if article["id"] in selected]
    require(len(articles) == len(selected) and {article["id"] for article in articles} == set(selected), "missing or duplicate article")
    aliases = json.loads(topics)
    require(all(isinstance(entries, dict) and all(language in {"en", "hu"} and isinstance(words, list)
                and all(isinstance(word, str) and word.strip() for word in words)
                for language, words in entries.items()) for entries in aliases.values()), "topic aliases")
    payload = {"manifest": {k: v for k, v in manifest.items() if k != "version"},
               "articles": articles, "topics": {k: v for k, v in aliases.items() if k in selected}}
    payload["manifest"]["version"] = digest(encode(payload))
    result = encode(payload)
    require(len(result) <= 8 * 1024 * 1024, "corpus size")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source", "manifest", "topics", "output"):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    result = build(args.source.read_bytes(), json.loads(args.manifest.read_bytes()), args.topics.read_bytes())
    with args.output.open("xb") as destination:
        destination.write(result)
