# Words that start a Filipino family name, so "Juan Dela Cruz" gives "Dela Cruz".
_PARTICLES = {
    "de",
    "del",
    "dela",
    "delos",
    "de la",
    "de los",
    "san",
    "santa",
    "sta.",
    "sto.",
    "santo",
}


def house_label(block: str, lot: str) -> str:
    return f"Block {block} Lot {lot}"


def family_name(owner_name: str) -> str:
    """The owner's family name. "Dela Cruz, Juan" and "Juan Dela Cruz" both give "Dela Cruz"."""
    name = " ".join(owner_name.split())
    if "," in name:
        return name.split(",", 1)[0].strip()
    words = name.split(" ")
    start = len(words) - 1
    while start > 0:
        before = words[start - 1].lower()
        two_before = " ".join(words[start - 2 : start]).lower() if start >= 2 else ""
        if two_before in _PARTICLES:
            start -= 2
        elif before in _PARTICLES:
            start -= 1
        else:
            break
    return " ".join(words[start:])


def residence_label(owner_name: str) -> str:
    return f"{family_name(owner_name)} Residence"
