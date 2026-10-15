"""Browser implementation of the repository's bibref.tools API."""
from js import bibref_call as _call
import json as _json

def _rpc(operation, *args):
    result = _json.loads(str(_call(operation, _json.dumps(args))))
    if not result.get("ok"):
        raise RuntimeError(result.get("message", "bibref operation failed"))
    return result.get("value")

def set_bibref_path(fullpath=""):
    raise NotImplementedError("Executable paths are unavailable in browser Python")

def spawn_bibref():
    raise NotImplementedError("Processes are unavailable in browser Python")

def text_n(c, greektext): return _rpc("text_n", c, greektext)
def latintext_n(c, latintext): return _rpc("latintext_n", c, latintext)
def lookup_n(c, passage): return _rpc("lookup_n", c, passage)
def raw_n(c, bible, book, start, length): return _rpc("raw_n", c, bible, book, start, length)
def find_n(c, bible): return _rpc("find_n", c, bible)
def maxresults(m): return _rpc("maxresults", m)
def jaccard12(): return _rpc("jaccard12")
def nearest12(): return tuple(_rpc("nearest12"))
def getrefs_maxlength(getrefs_input): return _rpc("getrefs_maxlength", getrefs_input)
def text1(text): return text_n(1, text)
def text2(text): return text_n(2, text)
def latintext1(text): return latintext_n(1, text)
def latintext2(text): return latintext_n(2, text)
def lookup1(passage): return lookup_n(1, passage)
def lookup2(passage): return lookup_n(2, passage)
def find1(bible): return find_n(1, bible)
def find2(bible): return find_n(2, bible)
def raw1(bible, book, start, length): return raw_n(1, bible, book, start, length)
def raw2(bible, book, start, length): return raw_n(2, bible, book, start, length)

def jaccard(t1, t2):
    text1(t1)
    text2(t2)
    return jaccard12()

def latin_to_greek(latin):
    # Preserve the original sequential replacement behavior, including w -> final sigma.
    for source, target in zip("abcdefghijklmnopqrstuvwxyz",
                              "αβψδεφγηιξκλμνοπζρστθωςχυζ"):
        latin = latin.replace(source, target)
    return latin

__all__ = ["set_bibref_path", "spawn_bibref", "text_n", "latintext_n", "lookup_n",
           "raw_n", "find_n", "maxresults", "jaccard12", "nearest12", "getrefs_maxlength",
           "text1", "text2", "latintext1", "latintext2", "lookup1", "lookup2", "find1",
           "find2", "raw1", "raw2", "jaccard", "latin_to_greek"]
