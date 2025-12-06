#!/usr/bin/env python3
"""
Generate test geospatial data for Spinifex
Creates sample files in various formats for testing the loaders.

Basic usage (no dependencies):
    python generate_test_data.py

With optional dependencies for more formats:
    pip install shapefile  # for .shp
    pip install numpy rasterio  # for .tif
"""

import json
import csv
import random
import math
import os
from pathlib import Path

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "test_data"

# Pilbara region bounds (Western Australia iron ore country)
BOUNDS = {
    "minLon": 116.5,
    "maxLon": 118.5,
    "minLat": -23.5,
    "maxLat": -21.5
}


def random_point():
    """Generate a random point within bounds."""
    return [
        random.uniform(BOUNDS["minLon"], BOUNDS["maxLon"]),
        random.uniform(BOUNDS["minLat"], BOUNDS["maxLat"])
    ]


def random_polygon(center, size=0.1, vertices=6):
    """Generate a random polygon around a center point."""
    coords = []
    for i in range(vertices):
        angle = (2 * math.pi * i) / vertices + random.uniform(-0.3, 0.3)
        r = size * random.uniform(0.5, 1.0)
        coords.append([
            center[0] + r * math.cos(angle),
            center[1] + r * math.sin(angle) * 0.7  # Slightly squashed
        ])
    coords.append(coords[0])  # Close the ring
    return coords


# =============================================================================
# GeoJSON Generation
# =============================================================================

def generate_drillholes_geojson(n=50):
    """Generate drillhole point data with assay results."""
    features = []

    rock_types = ["BIF", "Shale", "Dolerite", "Granite", "Laterite"]

    for i in range(n):
        point = random_point()

        # Simulate grade - higher near certain "ore bodies"
        base_fe = random.gauss(45, 15)
        base_fe = max(20, min(68, base_fe))  # Clamp to realistic range

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": point
            },
            "properties": {
                "hole_id": f"DDH-{i+1:04d}",
                "depth_m": random.randint(50, 400),
                "fe_pct": round(base_fe, 2),
                "sio2_pct": round(random.uniform(2, 15), 2),
                "al2o3_pct": round(random.uniform(1, 8), 2),
                "loi_pct": round(random.uniform(2, 12), 2),
                "rock_type": random.choice(rock_types),
                "year": random.randint(2018, 2024)
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


def generate_geology_geojson(n=15):
    """Generate geology polygon data."""
    features = []

    units = [
        {"code": "BIF", "name": "Banded Iron Formation", "age_ma": 2500, "color": "#8B0000"},
        {"code": "SHL", "name": "Shale", "age_ma": 2450, "color": "#556B2F"},
        {"code": "DOL", "name": "Dolerite", "age_ma": 2000, "color": "#2F4F4F"},
        {"code": "GRN", "name": "Granite", "age_ma": 2700, "color": "#FFB6C1"},
        {"code": "LAT", "name": "Laterite", "age_ma": 50, "color": "#CD853F"},
        {"code": "ALV", "name": "Alluvium", "age_ma": 1, "color": "#F5DEB3"},
    ]

    for i in range(n):
        center = random_point()
        unit = random.choice(units)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [random_polygon(center, size=random.uniform(0.15, 0.4))]
            },
            "properties": {
                "unit_id": i + 1,
                "code": unit["code"],
                "name": unit["name"],
                "age_ma": unit["age_ma"],
                "color": unit["color"],
                "confidence": random.choice(["High", "Medium", "Low"])
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


def generate_tenements_geojson(n=8):
    """Generate mining tenement polygons."""
    features = []

    tenement_types = ["Exploration", "Mining", "Prospecting", "Retention"]
    companies = ["Iron Ore Co", "Pilbara Mining", "Red Earth Resources", "Outback Minerals"]

    for i in range(n):
        # Tenements are typically more rectangular
        center = random_point()
        size = random.uniform(0.2, 0.5)

        # Create a more rectangular shape
        coords = [
            [center[0] - size, center[1] - size * 0.6],
            [center[0] + size, center[1] - size * 0.6],
            [center[0] + size, center[1] + size * 0.6],
            [center[0] - size, center[1] + size * 0.6],
            [center[0] - size, center[1] - size * 0.6]  # Close
        ]

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords]
            },
            "properties": {
                "tenement_id": f"E{random.randint(45,52)}/{random.randint(1000,9999)}",
                "type": random.choice(tenement_types),
                "holder": random.choice(companies),
                "area_km2": round(size * size * 111 * 111 * 0.6, 1),
                "granted": f"{random.randint(2010, 2023)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "status": random.choice(["Active", "Active", "Active", "Pending"])
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


def generate_tracks_geojson(n=5):
    """Generate track/road linestrings."""
    features = []

    track_types = ["Haul Road", "Access Track", "Exploration Track", "Service Road"]

    for i in range(n):
        # Generate a winding path
        start = random_point()
        coords = [start]

        current = start[:]
        for _ in range(random.randint(5, 12)):
            current = [
                current[0] + random.uniform(-0.1, 0.1),
                current[1] + random.uniform(-0.1, 0.1)
            ]
            coords.append(current)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            },
            "properties": {
                "track_id": i + 1,
                "name": f"{random.choice(track_types)} {i+1}",
                "surface": random.choice(["Gravel", "Dirt", "Sealed"]),
                "width_m": random.choice([4, 6, 8, 10, 15])
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


# =============================================================================
# CSV Generation
# =============================================================================

def generate_assays_csv(n=100):
    """Generate assay results CSV with coordinates."""
    rows = []

    for i in range(n):
        point = random_point()
        rows.append({
            "sample_id": f"S{i+1:05d}",
            "longitude": round(point[0], 6),
            "latitude": round(point[1], 6),
            "easting": round(point[0] * 111000, 1),  # Approximate UTM
            "northing": round(point[1] * 111000, 1),
            "fe_pct": round(random.gauss(50, 12), 2),
            "sio2_pct": round(random.uniform(2, 12), 2),
            "al2o3_pct": round(random.uniform(1, 6), 2),
            "p_pct": round(random.uniform(0.02, 0.15), 3),
            "s_pct": round(random.uniform(0.01, 0.08), 3),
            "sample_type": random.choice(["RC", "DD", "Surface", "Trench"])
        })

    return rows


def generate_survey_csv(n=200):
    """Generate survey points CSV."""
    rows = []

    for i in range(n):
        point = random_point()
        rows.append({
            "point_id": i + 1,
            "x": round(point[0], 6),
            "y": round(point[1], 6),
            "elevation_m": round(random.uniform(300, 600), 2),
            "description": random.choice(["Control", "Boundary", "Feature", "Grid"])
        })

    return rows


# =============================================================================
# Shapefile Generation (requires pyshp)
# =============================================================================

def generate_shapefile(geojson_data, name):
    """Convert GeoJSON to Shapefile."""
    try:
        import shapefile
    except ImportError:
        print(f"  Skipping {name}.shp (pip install pyshp)")
        return False

    features = geojson_data["features"]
    if not features:
        return False

    # Determine geometry type
    geom_type = features[0]["geometry"]["type"]

    shp_path = OUTPUT_DIR / name

    if geom_type == "Point":
        w = shapefile.Writer(str(shp_path), shapefile.POINT)
    elif geom_type == "LineString":
        w = shapefile.Writer(str(shp_path), shapefile.POLYLINE)
    elif geom_type == "Polygon":
        w = shapefile.Writer(str(shp_path), shapefile.POLYGON)
    else:
        return False

    # Add fields from first feature
    props = features[0]["properties"]
    for key, val in props.items():
        if isinstance(val, int):
            w.field(key[:10], 'N', 10, 0)
        elif isinstance(val, float):
            w.field(key[:10], 'N', 16, 6)
        else:
            w.field(key[:10], 'C', 100)

    # Add features
    for f in features:
        geom = f["geometry"]
        props = f["properties"]

        if geom_type == "Point":
            w.point(*geom["coordinates"])
        elif geom_type == "LineString":
            w.line([geom["coordinates"]])
        elif geom_type == "Polygon":
            w.poly(geom["coordinates"])

        w.record(*[props.get(k, "") for k in features[0]["properties"].keys()])

    w.close()

    # Write .prj file (WGS84)
    prj_content = 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'
    with open(str(shp_path) + ".prj", "w") as f:
        f.write(prj_content)

    return True


# =============================================================================
# GeoTIFF Generation (requires numpy + rasterio)
# =============================================================================

def generate_geotiff():
    """Generate a simple elevation/value GeoTIFF."""
    try:
        import numpy as np
        import rasterio
        from rasterio.transform import from_bounds
    except ImportError:
        print("  Skipping GeoTIFF (pip install numpy rasterio)")
        return False

    # Create a simple gradient with some noise (simulating elevation or magnetic data)
    width, height = 256, 256

    # Create coordinate grids
    x = np.linspace(0, 1, width)
    y = np.linspace(0, 1, height)
    xx, yy = np.meshgrid(x, y)

    # Generate interesting pattern (hills + anomalies)
    data = (
        300 +  # Base elevation
        100 * np.sin(xx * 3 * np.pi) * np.cos(yy * 2 * np.pi) +  # Rolling hills
        50 * np.exp(-((xx - 0.3)**2 + (yy - 0.4)**2) / 0.02) +  # Anomaly 1
        40 * np.exp(-((xx - 0.7)**2 + (yy - 0.6)**2) / 0.03) +  # Anomaly 2
        np.random.normal(0, 5, (height, width))  # Noise
    ).astype(np.float32)

    # Write GeoTIFF
    transform = from_bounds(
        BOUNDS["minLon"], BOUNDS["minLat"],
        BOUNDS["maxLon"], BOUNDS["maxLat"],
        width, height
    )

    tif_path = OUTPUT_DIR / "elevation.tif"

    with rasterio.open(
        tif_path,
        'w',
        driver='GTiff',
        height=height,
        width=width,
        count=1,
        dtype=data.dtype,
        crs='EPSG:4326',
        transform=transform,
        nodata=-9999
    ) as dst:
        dst.write(data, 1)

    # Also generate a multi-band RGB image
    rgb_data = np.zeros((3, height, width), dtype=np.uint8)

    # Normalize elevation to colors
    norm = (data - data.min()) / (data.max() - data.min())

    # Create a terrain-like colormap
    rgb_data[0] = (norm * 150 + 50).clip(0, 255).astype(np.uint8)  # R
    rgb_data[1] = ((1 - norm) * 100 + norm * 200).clip(0, 255).astype(np.uint8)  # G
    rgb_data[2] = ((1 - norm) * 150 + 50).clip(0, 255).astype(np.uint8)  # B

    rgb_path = OUTPUT_DIR / "satellite_rgb.tif"

    with rasterio.open(
        rgb_path,
        'w',
        driver='GTiff',
        height=height,
        width=width,
        count=3,
        dtype=np.uint8,
        crs='EPSG:4326',
        transform=transform
    ) as dst:
        dst.write(rgb_data)

    return True


# =============================================================================
# Main
# =============================================================================

def main():
    print("Generating Spinifex test data...")
    print(f"Output directory: {OUTPUT_DIR}")

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate GeoJSON files
    print("\nGeoJSON files:")

    datasets = {
        "drillholes": generate_drillholes_geojson(50),
        "geology": generate_geology_geojson(15),
        "tenements": generate_tenements_geojson(8),
        "tracks": generate_tracks_geojson(5)
    }

    for name, data in datasets.items():
        path = OUTPUT_DIR / f"{name}.geojson"
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  {path.name} ({len(data['features'])} features)")

    # Generate CSV files
    print("\nCSV files:")

    assays = generate_assays_csv(100)
    path = OUTPUT_DIR / "assays.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=assays[0].keys())
        writer.writeheader()
        writer.writerows(assays)
    print(f"  {path.name} ({len(assays)} rows)")

    survey = generate_survey_csv(200)
    path = OUTPUT_DIR / "survey_points.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=survey[0].keys())
        writer.writeheader()
        writer.writerows(survey)
    print(f"  {path.name} ({len(survey)} rows)")

    # Generate Shapefiles
    print("\nShapefiles:")
    for name, data in datasets.items():
        if generate_shapefile(data, name):
            print(f"  {name}.shp")

    # Generate GeoTIFFs
    print("\nGeoTIFF files:")
    if generate_geotiff():
        print("  elevation.tif (single band)")
        print("  satellite_rgb.tif (3 bands)")

    # Create a zip of drillholes shapefile for testing
    try:
        import zipfile
        shp_files = list(OUTPUT_DIR.glob("drillholes.*"))
        if shp_files:
            zip_path = OUTPUT_DIR / "drillholes_shp.zip"
            with zipfile.ZipFile(zip_path, 'w') as zf:
                for f in shp_files:
                    zf.write(f, f.name)
            print(f"\nZipped shapefile: drillholes_shp.zip")
    except Exception as e:
        print(f"  Could not create zip: {e}")

    print("\nDone! Drag files onto Spinifex to test.")


if __name__ == "__main__":
    main()
