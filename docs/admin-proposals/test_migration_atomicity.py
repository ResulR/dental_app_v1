#!/usr/bin/python3 -I
"""Intégration réelle du lanceur installé ; jamais exécuté root depuis le projet."""
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

BASE = Path('/var/lib/dental-lab-migrations')
INSTALLED = BASE / 'admin-tests' / 'test_migration_atomicity.py'
ENV = {'PATH': '/usr/bin:/bin', 'HOME': '/', 'LANG': 'C.UTF-8'}
CASES = [
    ('9901_atomicity_success_probe.sql', '87c25620081222a9269556b22b669578fe5acd446b9764d67d155f14e132d1a8', 'success'),
    ('9900_atomicity_failure_probe.sql', 'f85b33d4fd07f97891b295ee8eac1dc5fa91d6638c6d4e1473c4899dedb64615', 'failure'),
]


def absent(kind):
    # Requête fixe en lecture seule, sous audit, uniquement dental_lab.
    table = 'public.dental_lab_atomicity_' + kind + '_probe_2_6'
    sql = "SELECT to_regclass('" + table + "') IS NULL;"
    result = subprocess.run(['/usr/sbin/runuser', '-u', 'dental-ai', '--',
        '/usr/lib/postgresql/17/bin/psql', '-X', '-w', '-h', '/var/run/postgresql',
        '-p', '5432', '-U', 'dental-ai', '-d', 'dental_lab', '-At',
        '-v', 'ON_ERROR_STOP=1', '-c', sql], env=ENV, cwd='/',
        stdin=subprocess.DEVNULL, capture_output=True, text=True, check=True)
    if result.stdout.strip() != 't':
        raise RuntimeError('Objet présent : arrêter sans suppression : ' + table)


def main():
    if os.geteuid() != 0:
        print('BLOQUÉ : intégration DDL nécessite opérateur approuvé et exécutant dédié', file=sys.stderr)
        return 77
    if Path(__file__).absolute() != INSTALLED:
        raise RuntimeError('Utiliser seulement la copie root protégée du test')
    for p in [INSTALLED, Path('/usr/local/sbin/dental-lab-migrate')]:
        st = p.lstat()
        if not stat.S_ISREG(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
            raise RuntimeError('Copie test/lanceur non protégée')
        for parent in p.parents:
            st = parent.lstat()
            if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
                raise RuntimeError('Parent test/lanceur non protégé')
    for version, expected, kind in CASES:
        absent(kind)
        result_closed = subprocess.run(['/usr/sbin/runuser', '-u', 'dental-ai', '--',
            '/usr/lib/postgresql/17/bin/psql', '-X', '-w', '-h', '/var/run/postgresql',
            '-p', '5432', '-U', 'dental-ai', '-d', 'dental_lab', '-At',
            '-v', 'ON_ERROR_STOP=1', '-c',
            "SELECT NOT rolcanlogin AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='dental-migrate') FROM pg_roles WHERE rolname='dental-migrate';"],
            env=ENV, cwd='/', stdin=subprocess.DEVNULL, capture_output=True, text=True, check=True)
        if result_closed.stdout.strip() != 't':
            raise RuntimeError('NOLOGIN/zéro session non démontré')
        receipt = BASE / 'receipts' / version
        pending = BASE / 'receipts' / (version + '.pending')
        if os.path.lexists(receipt) or os.path.lexists(pending):
            raise RuntimeError('Fixture déjà exécutée/incertaine : pas de répétition automatique')
        result = subprocess.run(['/usr/local/sbin/dental-lab-migrate', version, expected],
            env=ENV, cwd='/', stdin=subprocess.DEVNULL, capture_output=True, text=True)
        # Écarte un faux succès causé par absence de rôle, fichier, droits, etc.
        if 'CREATE TABLE' not in result.stdout or 'INSERT 0 1' not in result.stdout:
            raise RuntimeError('Les opérations précédant l’erreur n’ont pas été démontrées')
        absent(kind)
        if kind == 'failure':
            result_closed = subprocess.run(['/usr/sbin/runuser', '-u', 'dental-ai', '--',
                '/usr/lib/postgresql/17/bin/psql', '-X', '-w', '-h', '/var/run/postgresql',
                '-p', '5432', '-U', 'dental-ai', '-d', 'dental_lab', '-At',
                '-v', 'ON_ERROR_STOP=1', '-c',
                "SELECT NOT rolcanlogin AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='dental-migrate') FROM pg_roles WHERE rolname='dental-migrate';"],
                env=ENV, cwd='/', stdin=subprocess.DEVNULL, capture_output=True, text=True, check=True)
            if result_closed.stdout.strip() != 't':
                raise RuntimeError('Fermeture après erreur non démontrée')
            if result.returncode == 0 or '22012' not in result.stderr or receipt.exists() or not pending.exists():
                raise RuntimeError('Échec/rollback/pending non démontrés')
            marker = pending
        else:
            if result.returncode != 0 or pending.exists() or not receipt.exists():
                raise RuntimeError('Contrôle positif/reçu non démontrés')
            marker = receipt
        if json.loads(marker.read_text())['sha256'] != expected:
            raise RuntimeError('Checksum registre incohérent')
        print('VALIDÉ', kind, ': CREATE + INSERT observés, aucune table persistante')
    print('Rollback DDL/DML réel et contrôle positif démontrés sur dental_lab')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
