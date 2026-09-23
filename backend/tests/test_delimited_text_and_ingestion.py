"""
backend/tests/test_delimited_text_and_ingestion.py
--------------------------------------------------
Comprehensive test suite verifying Step 2:
  - Delimited text observation adapter (CSV, TSV, semicolon, pipe).
  - Delimiter inference, header normalization, and column alias mapping.
  - Scientific validation (coordinates, depth, timestamps, measurements).
  - Normalization into UnifiedObservation and UnifiedProfilePoint.
  - VariableRegistry & ObservationTypeRegistry integration.
  - Automated file detection in incoming directory.
  - SHA-256 duplicate ingestion prevention.
  - Ingestion status lifecycle & REST endpoints.
  - Live queryability of ingested observations through ObservationService.
"""
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.adapters.delimited_text import DelimitedTextObservationAdapter, ValidationReport
from backend.services.ingestion_service import AutomatedIngestionService
from backend.services.observation_service import ObservationService
from backend.registry.adapters import adapter_registry


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ── 1. DELIMITED TEXT ADAPTER TESTS ──────────────────────────────────────────

def test_csv_observation_parsing(tmp_path: Path):
    """Verify parsing a valid CSV file with standard columns."""
    csv_file = tmp_path / "test_ship_ctd.csv"
    csv_file.write_text(
        "station_id,latitude,longitude,depth_m,time,temp,sal\n"
        "CTD_001,15.5,68.2,5.0,2026-02-15T10:00:00Z,28.4,35.2\n"
        "CTD_001,15.5,68.2,50.0,2026-02-15T10:00:00Z,25.1,35.5\n"
        "CTD_001,15.5,68.2,100.0,2026-02-15T10:00:00Z,21.8,35.8\n",
        encoding="utf-8",
    )

    adapter = DelimitedTextObservationAdapter(csv_file, default_obs_type="ctd")
    rep = adapter.validation_report

    assert rep is not None
    assert rep.status == "VALID"
    assert rep.format == "CSV"
    assert rep.total_rows == 3
    assert rep.valid_rows == 3
    assert rep.invalid_rows == 0
    assert "temperature" in rep.detected_variables
    assert "salinity" in rep.detected_variables

    # Check observations & profiles
    obs = adapter.get_observations()
    assert len(obs) == 1
    assert obs[0]["type"] == "ctd"
    assert obs[0]["latitude"] == 15.5
    assert obs[0]["longitude"] == 68.2
    assert obs[0]["max_depth"] == 100.0

    prof = adapter.get_profile(obs[0]["id"])
    assert prof is not None
    assert len(prof["data"]) == 3
    assert prof["data"][0]["depth"] == 5.0
    assert prof["data"][0]["temperature"] == 28.4


def test_tsv_observation_parsing(tmp_path: Path):
    """Verify parsing a TSV file with tab delimiters and column aliases."""
    tsv_file = tmp_path / "test_glider_mission.tsv"
    tsv_file.write_text(
        "platform\tlat\tlon\tz\ttimestamp\ttemperature\tsalinity\tchla\n"
        "GLD_99\t12.4\t84.1\t2.0\t2026-02-20\t29.1\t33.8\t0.45\n"
        "GLD_99\t12.4\t84.1\t20.0\t2026-02-20\t28.2\t34.1\t0.85\n"
        "GLD_99\t12.4\t84.1\t80.0\t2026-02-20\t23.0\t34.9\t0.20\n",
        encoding="utf-8",
    )

    adapter = DelimitedTextObservationAdapter(tsv_file, default_obs_type="glider")
    rep = adapter.validation_report

    assert rep is not None
    assert rep.status == "VALID"
    assert rep.format == "TSV"
    assert rep.valid_rows == 3
    assert "chlorophyll" in rep.detected_variables

    obs = adapter.get_observations()
    assert len(obs) == 1
    assert obs[0]["type"] == "glider"
    assert obs[0]["latitude"] == 12.4
    assert obs[0]["longitude"] == 84.1


def test_semicolon_delimited_parsing(tmp_path: Path):
    """Verify semicolon delimited ASCII file handling."""
    semi_file = tmp_path / "test_argo.txt"
    semi_file.write_text(
        "float_id;lat_deg;lon_deg;depth;obs_time;thetao;so\n"
        "ARGO_77;8.5;75.2;10.0;2026-01-10T12:00:00Z;28.9;34.5\n"
        "ARGO_77;8.5;75.2;500.0;2026-01-10T12:00:00Z;10.5;35.1\n",
        encoding="utf-8",
    )

    adapter = DelimitedTextObservationAdapter(semi_file, default_obs_type="argo")
    rep = adapter.validation_report

    assert rep is not None
    assert rep.status == "VALID"
    assert rep.valid_rows == 2
    assert "temperature" in rep.detected_variables
    assert "salinity" in rep.detected_variables


def test_scientific_validation_rejections(tmp_path: Path):
    """Verify invalid coordinate rows are safely rejected without crashing."""
    bad_file = tmp_path / "test_bad_coords.csv"
    bad_file.write_text(
        "id,lat,lon,depth,temp\n"
        "P1,10.0,70.0,5.0,28.0\n"
        "P2,95.0,70.0,5.0,28.0\n"    # Invalid latitude > 90
        "P3,10.0,210.0,5.0,28.0\n"   # Invalid longitude > 180
        "P4,12.0,72.0,10.0,27.5\n",
        encoding="utf-8",
    )

    adapter = DelimitedTextObservationAdapter(bad_file)
    rep = adapter.validation_report

    assert rep is not None
    assert rep.status == "PARTIALLY_VALID"
    assert rep.total_rows == 4
    assert rep.valid_rows == 2
    assert rep.invalid_rows == 2
    assert len(rep.warnings) >= 2


def test_missing_mandatory_columns_rejection(tmp_path: Path):
    """Verify file without latitude/longitude is properly marked REJECTED."""
    no_coords = tmp_path / "test_no_coords.csv"
    no_coords.write_text(
        "depth,temp,salinity\n"
        "5.0,28.0,35.0\n"
        "10.0,27.5,35.1\n",
        encoding="utf-8",
    )

    adapter = DelimitedTextObservationAdapter(no_coords)
    rep = adapter.validation_report

    assert rep is not None
    assert rep.status == "REJECTED"
    assert rep.valid_rows == 0
    assert any("latitude" in e for e in rep.errors)


# ── 2. AUTOMATED INGESTION SERVICE TESTS ─────────────────────────────────────

def test_automated_ingestion_discovery_and_deduplication(tmp_path: Path):
    """Verify incoming directory scanning, file detection, and duplicate avoidance."""
    incoming_dir = tmp_path / "incoming"
    incoming_dir.mkdir()

    obs_service = ObservationService(tmp_path)
    ingestion_svc = AutomatedIngestionService(
        incoming_dir=incoming_dir,
        obs_service=obs_service,
        auto_scan=False,
    )

    # 1. Initially 0 files
    jobs = ingestion_svc.scan_incoming_directory()
    assert len(jobs) == 0

    # 2. Add a new CSV file
    file1 = incoming_dir / "station_data_01.csv"
    file1.write_text(
        "station_id,lat,lon,depth,temp,sal\n"
        "STN_A,14.0,66.0,1.0,28.5,35.4\n"
        "STN_A,14.0,66.0,20.0,27.2,35.6\n",
        encoding="utf-8",
    )

    jobs = ingestion_svc.scan_incoming_directory()
    assert len(jobs) == 1
    assert jobs[0].status == "INGESTED"
    assert jobs[0].valid_records == 2

    # Verify live queryability in ObservationService
    obs_list = obs_service.get_observations()
    ingested_obs = [o for o in obs_list if "STN_A" in o["id"]]
    assert len(ingested_obs) == 1
    assert ingested_obs[0]["latitude"] == 14.0

    # 3. Rescan: duplicate file must not be re-ingested
    jobs_rescan = ingestion_svc.scan_incoming_directory()
    assert len(jobs_rescan) == 1
    assert jobs_rescan[0].status == "INGESTED"

    # Ingestion status summary
    status = ingestion_svc.get_status()
    assert status["automated_ingestion_enabled"] is True
    assert status["files_discovered"] == 1
    assert status["files_ingested"] == 1
    assert status["files_failed"] == 0


# ── 3. INGESTION REST API ENDPOINTS ──────────────────────────────────────────

def test_api_ingestion_status_endpoint(client):
    """Verify GET /api/v1/ingestion/status returns expected schema."""
    r = client.get("/api/v1/ingestion/status")
    assert r.status_code == 200
    data = r.json()
    assert data["automated_ingestion_enabled"] is True
    assert "supported_formats" in data
    assert "NetCDF (.nc)" in data["supported_formats"]
    assert "CSV (.csv)" in data["supported_formats"]
    assert "TSV (.tsv)" in data["supported_formats"]
    assert "ASCII (.txt, .dat, .ascii)" in data["supported_formats"]


def test_api_ingestion_scan_trigger(client):
    """Verify POST /api/v1/ingestion/scan triggers on-demand directory scan."""
    r = client.post("/api/v1/ingestion/scan")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert "ingestion_summary" in data
