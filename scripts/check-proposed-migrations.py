#!/usr/bin/env python3
"""Offline candidate inventory only; never installs a gate or opens PostgreSQL."""
import importlib.util
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def candidate_inventory():
    if os.getuid() != 1002 or ROOT != Path('/srv/dental-lab'):
        raise ValueError('UNEXPECTED_PROJECT_IDENTITY')
    catalog = load('scripts/migration-catalog.py', 'reviewed_catalog')
    proposal = load('scripts/proposed-migration-validator.py', 'candidate_validator')
    gate = catalog.load_gate()  # exact historical bytes and hash still required
    rows = catalog.inventory(ROOT / 'migrations',
        lambda name, sha, data: proposal.validate(name, sha, data, gate.validate))
    if not proposal.EXCEPTIONS.keys() <= {row['version'] for row in rows}:
        raise ValueError('EXCEPTION_MISSING')
    return rows


if __name__ == '__main__':
    print(json.dumps({'mode': 'candidate_source_inventory_only',
                      'installed_receipts': 'not_read',
                      'migrations': candidate_inventory()}, indent=2))
