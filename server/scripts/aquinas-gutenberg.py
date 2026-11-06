"""Resolve article headings in the pinned Gutenberg plain-text edition."""
import hashlib
import re

SOURCE_SHA256 = "c9443221a31768991db4bbe37e6ed035b278143a6728af64dc8ba0cf8e79154d"
CORRECTION = "NINTH ARTICLE [I, Q. 19, Art. 8]"
HEADING = re.compile(r"^[A-Z]+ ARTICLE \[I, Q\. (\d+), Art\. (\d+)\]$", re.M)


def article_headings(source, questions=None):
    """Return normalized source and canonical locators with heading offsets."""
    pinned = hashlib.sha256(source).hexdigest() == SOURCE_SHA256
    text = source.decode("utf-8-sig").replace("\r\n", "\n")
    headings = {}
    for match in HEADING.finditer(text):
        question, article = match.groups()
        if questions is not None and int(question) not in questions:
            continue
        if pinned and match[0] == CORRECTION:
            article = "9"
        locator = f"ST.I.q{question}.a{article}"
        if locator in headings:
            raise ValueError(f"duplicate article locator: {locator}")
        headings[locator] = match.start()
    return text, headings


SECTION = re.compile(
    r"^(?:(?:Objection|Obj\.) (?P<objection>\d+):|"
    r"_?On the contrary_?,_?|_?I answer that_?,_?|"
    r"Reply (?:to )?Obj(?:ection|\.) (?P<reply>\d+):|"
    r"Reply to Objections?:)", re.M
)
END_ARTICLE = re.compile(r"^_{10,}\s*$", re.M)
SCOPE = set(range(1, 27)) | set(range(44, 50))
NO_STANDALONE_CONTRARY = {"ST.I.q10.a1", "ST.I.q19.a12", "ST.I.q48.a5"}
COLLECTIVE_ENDINGS = {
    "ST.I.q1.a4": "This is a sufficient answer to the Objections.",
    "ST.I.q6.a4": "This is a sufficient Reply to the Objections.",
    "ST.I.q16.a2": "And thus the Objections given are solved.",
}
QUESTION = re.compile(r"^QUESTION (\d+)\n\s*\n([^\n]+)", re.M)


def extract_articles(source):
    """Extract the approved scope from the pinned edition without reflowing prose."""
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError("unrecognized Gutenberg source digest")
    text, headings = article_headings(source, SCOPE)
    questions = {int(match[1]): match[2] for match in QUESTION.finditer(text)}
    for locator, start in headings.items():
        question = int(locator.split(".q")[1].split(".")[0])
        body_start = text.index("\n", start) + 1
        end = END_ARTICLE.search(text, body_start)
        if not end:
            raise ValueError(f"missing article boundary: {locator}")
        body = text[body_start:end.start()]
        markers = list(SECTION.finditer(body))
        if not markers:
            raise ValueError(f"missing section headings: {locator}")
        sections = []
        objections = []
        for index, marker in enumerate(markers):
            finish = markers[index + 1].start() if index + 1 < len(markers) else len(body)
            value = body[marker.start():finish].strip()
            if marker["objection"]:
                number = int(marker["objection"])
                objections.append(number)
                section = {"id": f"objection-{number}", "role": "objection", "number": number}
            elif marker["reply"]:
                number = int(marker["reply"])
                section = {"id": f"reply-{number}", "role": "reply", "respondsTo": [number]}
            elif marker[0].startswith("Reply"):
                section = {"id": "reply-collective", "role": "reply",
                           "respondsTo": objections.copy(), "collectiveReply": True}
            else:
                role = "sed_contra" if "contrary" in marker[0] else "respondeo"
                section = {"id": role, "role": role}
            sections.append({**section, "text": value})
        ending = COLLECTIVE_ENDINGS.get(locator)
        if ending:
            main = sections[-1]
            if main["role"] != "respondeo" or not main["text"].endswith(ending):
                raise ValueError(f"unexpected collective reply: {locator}")
            main["text"] = main["text"][:-len(ending)].rstrip()
            sections.append({"id": "reply-collective", "role": "reply",
                             "respondsTo": objections, "collectiveReply": True, "text": ending})
        yield {"id": locator, "title": body[:markers[0].start()].strip(),
               "questionTitle": questions[question], "sections": sections}
