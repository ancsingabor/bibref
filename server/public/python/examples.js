export const examples = {
  names: `# Book: bibref-hu-20260812+.pdf, exercise 2.1, p. 22
from bibref.tools import *

names = [
    "Farec", "Zara", "Esrwm", "Aram", "Aminadab", "Naasswn",
    "Salmwn", "Boec", "Raqab", "Iwbhd", "Rouj", "Iessai", "Dauid",
    "Solomwn", "Roboam", "Abia", "Asaf", "Iwsafat", "Iwram", "Oziac",
    "Iwajam", "Aqaz", "Ezekiac", "Manassh", "Amwc", "Iwsiac",
    "Ieqoniac", "Salajihl", "Zorobabel", "Abioud", "Eliakeim", "Azwr",
    "Sadwk", "Aqeim", "Elioud", "Eleazar", "Matjan", "Iakwb", "Iwshf",
]
maxresults(10000)
for name in names:
    text1(name)
    occurrences = find1("LXX")
    print(f"{name}:{len(occurrences)} ", end='')
print()
`,
  nearest: `# Book: bibref-hu-20260812+.pdf, exercise 2.5, p. 45
# Find the closest passages to Matthew 5:31 in three books of Moses.
# Whole-book nearest searches can take several minutes. Use Stop to cancel.
from bibref.tools import *

text2("Oc an apolush thn gunaika autou, dotw auth apostasion")
for book in ["Leviticus", "Numbers", "Deuteronomy"]:
    raw1("LXX", book, 1, -1)
    n = nearest12()  # n[0]: Jaccard distance (%); n[1]: matching text
    latintext1(n[1])
    print(n, find1("LXX"))
`,
  compare: `from bibref.tools import *

lookup1("LXX Genesis 1:1")
lookup2("LXX Genesis 1:1")
print("Jaccard distance:", jaccard12())
print("The terminal's clipboards stay unchanged.")
`,
  python: `import statistics

values = [20, 41, 1, 58, 27, 10]
print("Mean:", statistics.mean(values))
print("Total:", sum(values))
`,
};
