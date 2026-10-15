export const examples = {
  names: `from bibref.tools import *

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
