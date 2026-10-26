from plate_reader import near_matches, normalize


def test_normalize_strips_spaces_and_dashes():
    assert normalize(" nbc-1234 ") == "NBC1234"


def test_exact_match_has_distance_zero():
    assert [m.distance for m in near_matches("NBC 1234", ["NBC1234"])] == [0]


def test_ocr_confusions_count_as_equal():
    assert [m.distance for m in near_matches("N8C1234", ["NBC1234"])] == [0]
    assert [m.distance for m in near_matches("ABO1234", ["AB01234"])] == [0]


def test_one_character_off_is_a_near_match():
    matches = near_matches("NBC1235", ["NBC1234", "XYZ9876"])
    assert [(m.plate, m.distance) for m in matches] == [("NBC1234", 1)]


def test_two_characters_off_is_not_a_match():
    assert near_matches("NBC1299", ["NBC1234"]) == []


def test_empty_reading_matches_nothing():
    assert near_matches("--", ["NBC1234"]) == []
