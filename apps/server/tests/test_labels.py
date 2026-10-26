from guardhouse.labels import family_name, residence_label


def test_last_word_is_the_family_name():
    assert family_name("Maria Santos") == "Santos"


def test_particles_join_the_family_name():
    assert family_name("Juan Dela Cruz") == "Dela Cruz"
    assert family_name("Ana de los Reyes") == "de los Reyes"


def test_comma_form():
    assert family_name("Dela Cruz, Juan") == "Dela Cruz"


def test_residence_label():
    assert residence_label("Pedro  Bautista") == "Bautista Residence"
