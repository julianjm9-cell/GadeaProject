from __future__ import annotations

from adult_app_launcher import AdultAppConfig, run


CONFIG = AdultAppConfig(
    app_name="ESO Adultos",
    html_file="apps/eso-adultos/index.html",
    data_dir_name="ESOAdultos_Data",
    client_app="eso_adultos",
    license_label="ESO_ADULTOS",
)


if __name__ == "__main__":
    raise SystemExit(run(CONFIG))
